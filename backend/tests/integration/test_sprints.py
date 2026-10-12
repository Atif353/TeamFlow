from typing import Any

from httpx import AsyncClient

from tests.factories import (
    World,
    api_add_member,
    api_create_project,
    api_create_task,
    auth_headers,
)


async def setup_project(client: AsyncClient, world: World) -> dict[str, Any]:
    project = await api_create_project(client, world.manager)
    for user in (world.member, world.viewer):
        await api_add_member(client, world.manager, project["id"], user)
    return project


def status_id(project: dict[str, Any], name: str) -> str:
    return str(next(s["id"] for s in project["statuses"] if s["name"] == name))


async def create_sprint(
    client: AsyncClient, user: Any, project_id: str, name: str = "Sprint 1"
) -> dict[str, Any]:
    response = await client.post(
        f"/projects/{project_id}/sprints", json={"name": name}, headers=auth_headers(user)
    )
    assert response.status_code == 201, response.text
    result: dict[str, Any] = response.json()
    return result


async def test_manager_creates_and_starts_sprint(client: AsyncClient, world: World) -> None:
    project = await setup_project(client, world)
    sprint = await create_sprint(client, world.manager, project["id"])
    await api_create_task(
        client, world.manager, project["id"], sprint_id=sprint["id"], story_points=5
    )

    started = await client.post(
        f"/sprints/{sprint['id']}/start", json={}, headers=auth_headers(world.manager)
    )

    assert started.status_code == 200
    assert started.json()["state"] == "active"
    assert started.json()["committed_points"] == 5
    assert started.json()["start_date"] is not None


async def test_member_and_viewer_cannot_plan_sprints(client: AsyncClient, world: World) -> None:
    project = await setup_project(client, world)

    for user in (world.member, world.viewer):
        response = await client.post(
            f"/projects/{project['id']}/sprints",
            json={"name": "Nope"},
            headers=auth_headers(user),
        )
        assert response.status_code == 403


async def test_only_one_active_sprint_per_project(client: AsyncClient, world: World) -> None:
    project = await setup_project(client, world)
    first = await create_sprint(client, world.manager, project["id"], "One")
    second = await create_sprint(client, world.manager, project["id"], "Two")
    await client.post(f"/sprints/{first['id']}/start", json={}, headers=auth_headers(world.manager))

    response = await client.post(
        f"/sprints/{second['id']}/start", json={}, headers=auth_headers(world.manager)
    )

    assert response.status_code == 409
    assert response.json()["code"] == "active_sprint_exists"


async def test_completing_sprint_returns_unfinished_issues_to_backlog(
    client: AsyncClient, world: World
) -> None:
    project = await setup_project(client, world)
    sprint = await create_sprint(client, world.manager, project["id"])
    done = await api_create_task(
        client, world.manager, project["id"], sprint_id=sprint["id"], story_points=3
    )
    open_one = await api_create_task(
        client, world.manager, project["id"], sprint_id=sprint["id"], story_points=2
    )
    await client.post(
        f"/sprints/{sprint['id']}/start", json={}, headers=auth_headers(world.manager)
    )
    await client.patch(
        f"/tasks/{done['id']}/move",
        json={"status_id": status_id(project, "Done")},
        headers=auth_headers(world.manager),
    )

    completed = await client.post(
        f"/sprints/{sprint['id']}/complete", json={}, headers=auth_headers(world.manager)
    )
    backlog = await client.get(
        f"/projects/{project['id']}/backlog", headers=auth_headers(world.manager)
    )
    refreshed = await client.get(f"/tasks/{open_one['id']}", headers=auth_headers(world.manager))

    assert completed.json()["state"] == "completed"
    assert completed.json()["completed_points"] == 3
    assert refreshed.json()["sprint_id"] is None
    assert open_one["id"] in [item["id"] for item in backlog.json()["backlog"]]


async def test_complete_can_move_unfinished_to_next_sprint(
    client: AsyncClient, world: World
) -> None:
    project = await setup_project(client, world)
    active = await create_sprint(client, world.manager, project["id"], "Active")
    upcoming = await create_sprint(client, world.manager, project["id"], "Upcoming")
    task = await api_create_task(client, world.manager, project["id"], sprint_id=active["id"])
    await client.post(
        f"/sprints/{active['id']}/start", json={}, headers=auth_headers(world.manager)
    )

    await client.post(
        f"/sprints/{active['id']}/complete",
        json={"move_to_sprint_id": upcoming["id"]},
        headers=auth_headers(world.manager),
    )
    refreshed = await client.get(f"/tasks/{task['id']}", headers=auth_headers(world.manager))

    assert refreshed.json()["sprint_id"] == upcoming["id"]


async def test_epics_cannot_be_planned_into_sprints(client: AsyncClient, world: World) -> None:
    project = await setup_project(client, world)
    sprint = await create_sprint(client, world.manager, project["id"])

    response = await client.post(
        f"/projects/{project['id']}/tasks",
        json={"title": "Epic", "issue_type": "epic", "sprint_id": sprint["id"]},
        headers=auth_headers(world.manager),
    )

    assert response.status_code == 422
    assert response.json()["code"] == "epic_in_sprint"


async def test_rank_moves_issue_between_backlog_and_sprint(
    client: AsyncClient, world: World
) -> None:
    project = await setup_project(client, world)
    sprint = await create_sprint(client, world.manager, project["id"])
    first = await api_create_task(client, world.manager, project["id"], title="First")
    second = await api_create_task(client, world.manager, project["id"], title="Second")

    into_sprint = await client.patch(
        f"/tasks/{first['id']}/rank",
        json={"change_sprint": True, "sprint_id": sprint["id"]},
        headers=auth_headers(world.manager),
    )
    second_in = await client.patch(
        f"/tasks/{second['id']}/rank",
        json={
            "change_sprint": True,
            "sprint_id": sprint["id"],
            "previous_task_id": first["id"],
        },
        headers=auth_headers(world.manager),
    )
    backlog = await client.get(
        f"/projects/{project['id']}/backlog", headers=auth_headers(world.manager)
    )

    assert into_sprint.json()["sprint"]["name"] == "Sprint 1"
    assert second_in.json()["rank"] > into_sprint.json()["rank"]
    assert backlog.json()["backlog"] == []
    assert [i["id"] for i in backlog.json()["sprints"][0]["issues"]] == [first["id"], second["id"]]


async def test_rank_requires_sprint_management(client: AsyncClient, world: World) -> None:
    project = await setup_project(client, world)
    task = await api_create_task(client, world.member, project["id"])

    response = await client.patch(
        f"/tasks/{task['id']}/rank", json={}, headers=auth_headers(world.member)
    )

    assert response.status_code == 403


async def test_subtasks_follow_parent_into_sprint(client: AsyncClient, world: World) -> None:
    project = await setup_project(client, world)
    sprint = await create_sprint(client, world.manager, project["id"])
    parent = await api_create_task(client, world.manager, project["id"])
    child = await api_create_task(client, world.manager, project["id"], parent_id=parent["id"])

    await client.patch(
        f"/tasks/{parent['id']}",
        json={"sprint_id": sprint["id"]},
        headers=auth_headers(world.manager),
    )
    refreshed = await client.get(f"/tasks/{child['id']}", headers=auth_headers(world.manager))

    assert refreshed.json()["sprint_id"] == sprint["id"]


async def test_deleting_planned_sprint_returns_issues_to_backlog(
    client: AsyncClient, world: World
) -> None:
    project = await setup_project(client, world)
    sprint = await create_sprint(client, world.manager, project["id"])
    task = await api_create_task(client, world.manager, project["id"], sprint_id=sprint["id"])

    deleted = await client.delete(f"/sprints/{sprint['id']}", headers=auth_headers(world.manager))
    refreshed = await client.get(f"/tasks/{task['id']}", headers=auth_headers(world.manager))

    assert deleted.status_code == 204
    assert refreshed.json()["sprint_id"] is None


async def test_burndown_reflects_completed_points(client: AsyncClient, world: World) -> None:
    project = await setup_project(client, world)
    sprint = await create_sprint(client, world.manager, project["id"])
    done = await api_create_task(
        client, world.manager, project["id"], sprint_id=sprint["id"], story_points=3
    )
    await api_create_task(
        client, world.manager, project["id"], sprint_id=sprint["id"], story_points=5
    )
    await client.post(
        f"/sprints/{sprint['id']}/start", json={}, headers=auth_headers(world.manager)
    )
    await client.patch(
        f"/tasks/{done['id']}/move",
        json={"status_id": status_id(project, "Done")},
        headers=auth_headers(world.manager),
    )

    report = await client.get(
        f"/sprints/{sprint['id']}/burndown", headers=auth_headers(world.manager)
    )

    body = report.json()
    actual = [point["remaining"] for point in body["points"] if point["remaining"] is not None]
    assert body["unit"] == "points"
    assert body["total"] == 8
    assert actual[-1] == 5
    assert body["points"][0]["ideal"] == 8
    assert body["points"][-1]["ideal"] == 0


async def test_velocity_lists_completed_sprints(client: AsyncClient, world: World) -> None:
    project = await setup_project(client, world)
    sprint = await create_sprint(client, world.manager, project["id"])
    task = await api_create_task(
        client, world.manager, project["id"], sprint_id=sprint["id"], story_points=4
    )
    await client.post(
        f"/sprints/{sprint['id']}/start", json={}, headers=auth_headers(world.manager)
    )
    await client.patch(
        f"/tasks/{task['id']}/move",
        json={"status_id": status_id(project, "Done")},
        headers=auth_headers(world.manager),
    )
    await client.post(
        f"/sprints/{sprint['id']}/complete", json={}, headers=auth_headers(world.manager)
    )

    report = await client.get(
        f"/projects/{project['id']}/reports/velocity", headers=auth_headers(world.manager)
    )

    assert report.json()["sprints"][0]["completed_points"] == 4
    assert report.json()["average_points"] == 4
