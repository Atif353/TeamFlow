from beanie import PydanticObjectId
from httpx import AsyncClient

from app.models.comment import Comment
from app.models.label import Label
from app.models.project_member import ProjectMember
from app.models.task import Task
from app.permissions.roles import Role
from tests.factories import (
    World,
    api_add_member,
    api_create_project,
    api_create_task,
    auth_headers,
    create_user,
)


async def test_manager_creates_project_with_default_statuses_and_membership(
    client: AsyncClient, world: World
) -> None:
    project = await api_create_project(client, world.manager)

    assert [s["name"] for s in project["statuses"]] == [
        "To Do",
        "In Progress",
        "In Review",
        "Done",
    ]
    assert [s["is_done"] for s in project["statuses"]] == [False, False, False, True]
    assert project["my_role"] == "project_manager"
    assert project["member_count"] == 1
    assert await ProjectMember.find({"project_id": PydanticObjectId(project["id"])}).count() == 1


async def test_member_and_viewer_cannot_create_projects(client: AsyncClient, world: World) -> None:
    for user in (world.member, world.viewer):
        response = await client.post(
            "/projects", json={"name": "Nope", "key": "NOPE"}, headers=auth_headers(user)
        )
        assert response.status_code == 403


async def test_duplicate_project_key_in_workspace_is_conflict(
    client: AsyncClient, world: World
) -> None:
    await api_create_project(client, world.manager, key="DUPE")

    response = await client.post(
        "/projects", json={"name": "Other", "key": "dupe"}, headers=auth_headers(world.manager)
    )

    assert response.status_code == 409
    assert response.json()["code"] == "project_key_taken"


async def test_viewer_sees_only_projects_they_were_added_to(
    client: AsyncClient, world: World
) -> None:
    shared = await api_create_project(client, world.manager, name="Shared")
    hidden = await api_create_project(client, world.manager, name="Hidden")
    await api_add_member(client, world.manager, shared["id"], world.viewer)

    response = await client.get("/projects", headers=auth_headers(world.viewer))

    ids = [item["id"] for item in response.json()["items"]]
    assert ids == [shared["id"]]
    assert hidden["id"] not in ids
    assert response.json()["items"][0]["my_role"] == "viewer"


async def test_non_member_gets_404_not_403(client: AsyncClient, world: World) -> None:
    project = await api_create_project(client, world.manager)

    response = await client.get(f"/projects/{project['id']}", headers=auth_headers(world.member))
    malformed = await client.get("/projects/not-an-id", headers=auth_headers(world.member))

    assert response.status_code == 404
    assert malformed.status_code == 404


async def test_super_admin_lists_every_project(client: AsyncClient, world: World) -> None:
    first = await api_create_project(client, world.manager)
    second = await api_create_project(client, world.manager)

    response = await client.get("/projects", headers=auth_headers(world.admin))

    ids = {item["id"] for item in response.json()["items"]}
    assert {first["id"], second["id"]} <= ids
    assert response.json()["items"][0]["my_role"] == "super_admin"


async def test_delete_project_cascades(client: AsyncClient, world: World) -> None:
    project = await api_create_project(client, world.manager)
    await api_add_member(client, world.manager, project["id"], world.member)
    task = await api_create_task(client, world.member, project["id"])
    await client.post(
        f"/tasks/{task['id']}/comments", json={"body": "hi"}, headers=auth_headers(world.member)
    )
    await client.post(
        f"/projects/{project['id']}/labels",
        json={"name": "bug"},
        headers=auth_headers(world.member),
    )

    response = await client.delete(
        f"/projects/{project['id']}", headers=auth_headers(world.manager)
    )

    assert response.status_code == 204
    assert await Task.find({"project_id": PydanticObjectId(project["id"])}).count() == 0
    assert await Comment.find({"project_id": PydanticObjectId(project["id"])}).count() == 0
    assert await Label.find({"project_id": PydanticObjectId(project["id"])}).count() == 0
    assert await ProjectMember.find({"project_id": PydanticObjectId(project["id"])}).count() == 0


async def test_member_cannot_delete_or_edit_project(client: AsyncClient, world: World) -> None:
    project = await api_create_project(client, world.manager)
    await api_add_member(client, world.manager, project["id"], world.member)

    deleted = await client.delete(f"/projects/{project['id']}", headers=auth_headers(world.member))
    edited = await client.patch(
        f"/projects/{project['id']}", json={"name": "New"}, headers=auth_headers(world.member)
    )

    assert deleted.status_code == edited.status_code == 403


async def test_manager_not_in_project_cannot_manage_it(client: AsyncClient, world: World) -> None:
    project = await api_create_project(client, world.manager)
    other_manager = await create_user(world.workspace, Role.PROJECT_MANAGER)

    response = await client.delete(
        f"/projects/{project['id']}", headers=auth_headers(other_manager)
    )

    assert response.status_code == 404


async def test_project_override_makes_member_read_only_in_that_project_only(
    client: AsyncClient, world: World
) -> None:
    restricted = await api_create_project(client, world.manager, name="Restricted")
    normal = await api_create_project(client, world.manager, name="Normal")
    await api_add_member(client, world.admin, restricted["id"], world.member, Role.VIEWER)
    await api_add_member(client, world.manager, normal["id"], world.member)

    blocked = await client.post(
        f"/projects/{restricted['id']}/tasks",
        json={"title": "x"},
        headers=auth_headers(world.member),
    )
    allowed = await client.post(
        f"/projects/{normal['id']}/tasks", json={"title": "x"}, headers=auth_headers(world.member)
    )

    assert blocked.status_code == 403
    assert allowed.status_code == 201


async def test_only_super_admin_can_set_override_when_adding_member(
    client: AsyncClient, world: World
) -> None:
    project = await api_create_project(client, world.manager)

    response = await client.post(
        f"/projects/{project['id']}/members",
        json={"user_id": str(world.member.pk), "role_override": "viewer"},
        headers=auth_headers(world.manager),
    )

    assert response.status_code == 403


async def test_add_remove_member_and_conflicts(client: AsyncClient, world: World) -> None:
    project = await api_create_project(client, world.manager)
    await api_add_member(client, world.manager, project["id"], world.member)

    duplicate = await client.post(
        f"/projects/{project['id']}/members",
        json={"user_id": str(world.member.pk)},
        headers=auth_headers(world.manager),
    )
    listing = await client.get(
        f"/projects/{project['id']}/members", headers=auth_headers(world.member)
    )
    removed = await client.delete(
        f"/projects/{project['id']}/members/{world.member.pk}", headers=auth_headers(world.manager)
    )
    after = await client.get(f"/projects/{project['id']}", headers=auth_headers(world.member))

    assert duplicate.status_code == 409
    assert listing.json()["total"] == 2
    assert removed.status_code == 204
    assert after.status_code == 404


async def test_member_cannot_manage_members(client: AsyncClient, world: World) -> None:
    project = await api_create_project(client, world.manager)
    await api_add_member(client, world.manager, project["id"], world.member)

    response = await client.post(
        f"/projects/{project['id']}/members",
        json={"user_id": str(world.viewer.pk)},
        headers=auth_headers(world.member),
    )

    assert response.status_code == 403


async def test_update_project_details(client: AsyncClient, world: World) -> None:
    project = await api_create_project(client, world.manager)

    response = await client.patch(
        f"/projects/{project['id']}",
        json={"name": "Renamed", "color": "#10B981"},
        headers=auth_headers(world.manager),
    )

    assert response.status_code == 200
    assert response.json()["name"] == "Renamed"
    assert response.json()["color"] == "#10B981"
