from app.permissions.context import AuthContext
from app.repositories.doc_repository import doc_repository
from app.repositories.project_repository import project_repository
from app.repositories.task_repository import TaskFilters, task_repository
from app.schemas.search import SearchDoc, SearchIssue, SearchProject, SearchResults
from app.services import project_service
from app.services.task_output import brief_of

ISSUE_LIMIT = 10
DOC_LIMIT = 5
PROJECT_LIMIT = 5


async def search(auth: AuthContext, query: str) -> SearchResults:
    text = query.strip()
    if not text:
        return SearchResults(issues=[], docs=[], projects=[])
    project_ids = await project_service.visible_project_ids(auth)
    projects = {
        project.pk: project for project in await project_repository.find_by_ids(project_ids)
    }
    tasks, _ = await task_repository.list_for_projects(
        project_ids, TaskFilters(include_subtasks=True, q=text), "updated_at", True, 0, ISSUE_LIMIT
    )
    docs = await doc_repository.search_titles(project_ids, text, DOC_LIMIT)
    lowered = text.lower()
    matching_projects = [
        project
        for project in projects.values()
        if lowered in project.name.lower() or lowered in project.key.lower()
    ][:PROJECT_LIMIT]
    return SearchResults(
        issues=[
            SearchIssue(
                **brief_of(task, projects[task.project_id]).model_dump(),
                project_id=task.project_id,
                project_name=projects[task.project_id].name,
            )
            for task in tasks
        ],
        docs=[
            SearchDoc(
                id=doc.pk,
                title=doc.title,
                project_id=doc.project_id,
                project_name=projects[doc.project_id].name,
            )
            for doc in docs
            if doc.project_id in projects
        ],
        projects=[
            SearchProject(id=p.pk, name=p.name, key=p.key, color=p.color) for p in matching_projects
        ],
    )
