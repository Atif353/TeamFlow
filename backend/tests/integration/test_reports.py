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


async def test_summary_counts_match_issues(client: AsyncClient, world: World) -> None:
    project = await setup_project(client, world)
    await api_create_task(client, world.manager, project["id"], issue_type="bug", priority="urgent")
    done = await api_create_task(
        client,
        world.manager,
        project["id"],
        issue_type="story",
        assignee_id=str(world.member.pk),
        original_estimate_minutes=60,
    )
    await api_create_task(client, world.manager, project["id"], due_date="2020-01-01")
    await client.patch(
        f"/tasks/{done['id']}/move",
        json={"status_id": status_id(project, "Done")},
        headers=auth_headers(world.manager),
    )

    response = await client.get(
        f"/projects/{project['id']}/summary", headers=auth_headers(world.viewer)
    )

    body = response.json()
    assert body["total"] == 3
    assert body["done"] == 1
    assert body["open"] == 2
    assert body["overdue"] == 1
    assert body["unassigned"] == 2
    assert body["estimate_minutes"] == 60
    assert sum(item["count"] for item in body["status_counts"]) == 3
    assert {item["key"]: item["count"] for item in body["type_counts"]} == {
        "bug": 1,
        "story": 1,
        "task": 1,
    }
    today = body["created_vs_resolved"][-1]
    assert today["created"] == 3
    assert today["resolved"] == 1
    assert body["recent_activity"]


async def test_summary_is_hidden_from_non_members(client: AsyncClient, world: World) -> None:
    project = await api_create_project(client, world.manager)

    response = await client.get(
        f"/projects/{project['id']}/summary", headers=auth_headers(world.member)
    )

    assert response.status_code == 404


async def test_time_tracking_report_totals(client: AsyncClient, world: World) -> None:
    project = await setup_project(client, world)
    task = await api_create_task(
        client, world.manager, project["id"], original_estimate_minutes=300
    )
    await client.post(
        f"/tasks/{task['id']}/worklogs", json={"minutes": 45}, headers=auth_headers(world.member)
    )
    await client.post(
        f"/tasks/{task['id']}/worklogs", json={"minutes": 15}, headers=auth_headers(world.manager)
    )

    response = await client.get(
        f"/projects/{project['id']}/reports/time-tracking?days=7",
        headers=auth_headers(world.manager),
    )

    body = response.json()
    assert body["spent_minutes"] == 60
    assert body["estimate_minutes"] == 300
    assert body["remaining_minutes"] == 240
    assert {row["user"]["name"]: row["minutes"] for row in body["by_user"]} == {
        world.member.name: 45,
        world.manager.name: 15,
    }
    assert sum(day["minutes"] for day in body["by_day"]) == 60
    assert body["top_issues"][0]["key"] == task["key"]


async def test_workload_groups_open_issues_by_assignee(client: AsyncClient, world: World) -> None:
    project = await setup_project(client, world)
    await api_create_task(
        client, world.manager, project["id"], assignee_id=str(world.member.pk), story_points=3
    )
    await api_create_task(
        client, world.manager, project["id"], assignee_id=str(world.member.pk), story_points=2
    )
    await api_create_task(client, world.manager, project["id"])

    response = await client.get(
        f"/projects/{project['id']}/reports/workload", headers=auth_headers(world.manager)
    )

    rows = {(row["user"] or {}).get("name"): row for row in response.json()["rows"]}
    assert rows[world.member.name]["count"] == 2
    assert rows[world.member.name]["points"] == 5
    assert rows[None]["count"] == 1


async def test_cumulative_flow_tracks_status_over_time(client: AsyncClient, world: World) -> None:
    project = await setup_project(client, world)
    task = await api_create_task(client, world.manager, project["id"])
    await api_create_task(client, world.manager, project["id"])
    await client.patch(
        f"/tasks/{task['id']}/move",
        json={"status_id": status_id(project, "In Progress")},
        headers=auth_headers(world.manager),
    )

    response = await client.get(
        f"/projects/{project['id']}/reports/cumulative-flow", headers=auth_headers(world.manager)
    )

    body = response.json()
    by_name = {series["name"]: series["counts"] for series in body["series"]}
    assert len(body["dates"]) == 30
    assert by_name["To Do"][-1] == 1
    assert by_name["In Progress"][-1] == 1
    assert by_name["Done"][-1] == 0


async def test_releases_group_issues_and_can_be_shipped(client: AsyncClient, world: World) -> None:
    project = await setup_project(client, world)
    created = await client.post(
        f"/projects/{project['id']}/versions",
        json={"name": "v1.0", "release_date": "2030-01-31"},
        headers=auth_headers(world.manager),
    )
    version_id = created.json()["id"]
    task = await api_create_task(client, world.manager, project["id"], version_id=version_id)
    duplicate = await client.post(
        f"/projects/{project['id']}/versions",
        json={"name": "v1.0"},
        headers=auth_headers(world.manager),
    )
    member_try = await client.post(
        f"/projects/{project['id']}/versions",
        json={"name": "v2"},
        headers=auth_headers(world.member),
    )
    shipped = await client.patch(
        f"/versions/{version_id}", json={"released": True}, headers=auth_headers(world.manager)
    )
    listing = await client.get(
        f"/projects/{project['id']}/versions", headers=auth_headers(world.viewer)
    )

    assert task["version"]["name"] == "v1.0"
    assert duplicate.status_code == 409
    assert member_try.status_code == 403
    assert shipped.json()["released"] is True
    assert listing.json()[0]["issue_count"] == 1


async def test_saved_filters_are_personal(client: AsyncClient, world: World) -> None:
    project = await setup_project(client, world)
    created = await client.post(
        f"/projects/{project['id']}/filters",
        json={"name": "My bugs", "params": {"issue_type": "bug"}},
        headers=auth_headers(world.member),
    )
    mine = await client.get(
        f"/projects/{project['id']}/filters", headers=auth_headers(world.member)
    )
    theirs = await client.get(
        f"/projects/{project['id']}/filters", headers=auth_headers(world.manager)
    )
    foreign_delete = await client.delete(
        f"/filters/{created.json()['id']}", headers=auth_headers(world.manager)
    )
    own_delete = await client.delete(
        f"/filters/{created.json()['id']}", headers=auth_headers(world.member)
    )

    assert mine.json()[0]["params"] == {"issue_type": "bug"}
    assert theirs.json() == []
    assert foreign_delete.status_code == 404
    assert own_delete.status_code == 204


async def test_search_respects_visibility_and_case(client: AsyncClient, world: World) -> None:
    visible = await setup_project(client, world)
    hidden = await api_create_project(client, world.manager, key="SECRET")
    await api_create_task(client, world.manager, visible["id"], title="Fix Login Flow")
    await api_create_task(client, world.manager, hidden["id"], title="Secret login plan")

    found = await client.get("/search?q=login", headers=auth_headers(world.member))
    empty = await client.get("/search?q=", headers=auth_headers(world.member))
    admin_view = await client.get("/search?q=login", headers=auth_headers(world.admin))

    assert [item["title"] for item in found.json()["issues"]] == ["Fix Login Flow"]
    assert empty.json() == {"issues": [], "docs": [], "projects": []}
    assert len(admin_view.json()["issues"]) == 2


async def test_search_finds_by_issue_key_and_project(client: AsyncClient, world: World) -> None:
    project = await api_create_project(client, world.manager, key="FIND", name="Findable")
    task = await api_create_task(client, world.manager, project["id"], title="Needle")

    by_key = await client.get(f"/search?q={task['key']}", headers=auth_headers(world.manager))
    by_project = await client.get("/search?q=findable", headers=auth_headers(world.manager))

    assert by_key.json()["issues"][0]["key"] == "FIND-1"
    assert by_project.json()["projects"][0]["key"] == "FIND"
