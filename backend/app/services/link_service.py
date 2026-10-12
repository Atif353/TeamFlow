from beanie import PydanticObjectId

from app.core.exceptions import BusinessRuleError, ConflictError, NotFoundError
from app.models.issue_link import IssueLink, LinkType
from app.permissions.context import AuthContext
from app.permissions.matrix import Permission
from app.permissions.policies import require
from app.repositories.issue_link_repository import issue_link_repository
from app.repositories.task_repository import task_repository
from app.schemas.issue_link import IssueLinkCreate, IssueLinkOut, LinkDirection
from app.services import activity_service
from app.services.task_access import find_task, load_task
from app.services.task_output import brief_of
from app.utils.object_id import to_object_id

LINK_LABELS: dict[LinkType, tuple[str, str]] = {
    LinkType.BLOCKS: ("blocks", "is blocked by"),
    LinkType.DUPLICATES: ("duplicates", "is duplicated by"),
    LinkType.RELATES_TO: ("relates to", "relates to"),
    LinkType.CLONES: ("clones", "is cloned by"),
}


async def list_links(auth: AuthContext, ref: str) -> list[IssueLinkOut]:
    task, context = await load_task(auth, ref)
    links = await issue_link_repository.for_task(task.pk)
    others = {
        other.pk: other
        for other in await task_repository.find_by_ids(
            link.target_id if link.source_id == task.pk else link.source_id for link in links
        )
    }
    outputs: list[IssueLinkOut] = []
    for link in links:
        outward = link.source_id == task.pk
        other = others.get(link.target_id if outward else link.source_id)
        if other is None:
            continue
        label = LINK_LABELS[link.link_type][0 if outward else 1]
        outputs.append(
            IssueLinkOut(
                id=link.pk,
                link_type=link.link_type,
                direction=LinkDirection.OUTWARD if outward else LinkDirection.INWARD,
                label=label,
                issue=brief_of(other, context.project),
                created_at=link.created_at,
            )
        )
    return outputs


async def _reaches(
    edges: dict[PydanticObjectId, list[PydanticObjectId]],
    start: PydanticObjectId,
    goal: PydanticObjectId,
) -> bool:
    seen: set[PydanticObjectId] = set()
    stack = [start]
    while stack:
        current = stack.pop()
        if current == goal:
            return True
        if current in seen:
            continue
        seen.add(current)
        stack.extend(edges.get(current, []))
    return False


async def _ensure_no_cycle(
    project_id: PydanticObjectId, source_id: PydanticObjectId, target_id: PydanticObjectId
) -> None:
    edges: dict[PydanticObjectId, list[PydanticObjectId]] = {}
    for link in await issue_link_repository.blocking_edges(project_id):
        edges.setdefault(link.source_id, []).append(link.target_id)
    if await _reaches(edges, target_id, source_id):
        raise BusinessRuleError("This link would create a blocking cycle", code="link_cycle")


async def create_link(auth: AuthContext, ref: str, data: IssueLinkCreate) -> list[IssueLinkOut]:
    task, context = await load_task(auth, ref)
    require(context.role, Permission.TASK_CREATE, "You cannot link issues")
    target = await find_task(auth, data.target)
    if target.project_id != task.project_id:
        raise BusinessRuleError(
            "Issues can only be linked within the same project", code="cross_project_link"
        )
    if target.pk == task.pk:
        raise BusinessRuleError("An issue cannot be linked to itself", code="self_link")
    if data.link_type == LinkType.BLOCKS:
        await _ensure_no_cycle(task.project_id, task.pk, target.pk)
    if await issue_link_repository.exists_between(task.pk, target.pk, data.link_type):
        raise ConflictError("These issues are already linked", code="link_exists")
    await issue_link_repository.insert(
        IssueLink(
            project_id=task.project_id,
            source_id=task.pk,
            target_id=target.pk,
            link_type=data.link_type,
            created_by=auth.user.pk,
        )
    )
    label = LINK_LABELS[data.link_type][0]
    await activity_service.record(
        task,
        auth.user.pk,
        "link",
        field="link",
        new_value=f"{label} {context.project.key}-{target.issue_number}",
    )
    return await list_links(auth, ref)


async def delete_link(auth: AuthContext, link_id: str) -> None:
    link = await issue_link_repository.get(to_object_id(link_id))
    if link is None:
        raise NotFoundError("Link not found", code="link_not_found")
    source = await task_repository.get(link.source_id)
    if source is None:
        raise NotFoundError("Link not found", code="link_not_found")
    _, context = await load_task(auth, str(source.pk))
    require(context.role, Permission.TASK_CREATE, "You cannot unlink issues")
    await issue_link_repository.delete(link)
