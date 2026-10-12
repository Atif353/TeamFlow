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
    for user in (world.member, world.other_member, world.viewer):
        await api_add_member(client, world.manager, project["id"], user)
    return project


def status_id(project: dict[str, Any], name: str) -> str:
    return str(next(s["id"] for s in project["statuses"] if s["name"] == name))


def editable(status: dict[str, Any]) -> dict[str, Any]:
    return {key: status[key] for key in ("id", "name", "color", "is_done")}


async def restrict(client: AsyncClient, world: World, project: dict[str, Any]) -> None:
    todo, progress, review, done = (
        status_id(project, name) for name in ("To Do", "In Progress", "In Review", "Done")
    )
    response = await client.put(
        f"/projects/{project['id']}/workflow",
        json={
            "transitions": {todo: [progress], progress: [review, todo], review: [done, progress]}
        },
        headers=auth_headers(world.manager),
    )
    assert response.status_code == 200, response.text


async def test_workflow_blocks_status_jumps_on_move_and_update(
    client: AsyncClient, world: World
) -> None:
    project = await setup_project(client, world)
    await restrict(client, world, project)
    task = await api_create_task(client, world.manager, project["id"])

    jump = await client.patch(
        f"/tasks/{task['id']}/move",
        json={"status_id": status_id(project, "Done")},
        headers=auth_headers(world.manager),
    )
    update_jump = await client.patch(
        f"/tasks/{task['id']}",
        json={"status_id": status_id(project, "In Review")},
        headers=auth_headers(world.manager),
    )
    allowed = await client.patch(
        f"/tasks/{task['id']}/move",
        json={"status_id": status_id(project, "In Progress")},
        headers=auth_headers(world.manager),
    )

    assert jump.status_code == 422
    assert jump.json()["code"] == "transition_not_allowed"
    assert update_jump.json()["code"] == "transition_not_allowed"
    assert allowed.status_code == 200


async def test_statuses_without_rules_stay_unrestricted(client: AsyncClient, world: World) -> None:
    project = await setup_project(client, world)
    task = await api_create_task(client, world.manager, project["id"])

    response = await client.patch(
        f"/tasks/{task['id']}/move",
        json={"status_id": status_id(project, "Done")},
        headers=auth_headers(world.manager),
    )

    assert response.status_code == 200


async def test_only_managers_edit_the_workflow_and_ids_are_validated(
    client: AsyncClient, world: World
) -> None:
    project = await setup_project(client, world)
    todo = status_id(project, "To Do")

    member = await client.put(
        f"/projects/{project['id']}/workflow",
        json={"transitions": {todo: []}},
        headers=auth_headers(world.member),
    )
    unknown = await client.put(
        f"/projects/{project['id']}/workflow",
        json={"transitions": {todo: ["nope"]}},
        headers=auth_headers(world.manager),
    )

    assert member.status_code == 403
    assert unknown.status_code == 422


async def test_deleting_a_status_removes_it_from_the_workflow(
    client: AsyncClient, world: World
) -> None:
    project = await setup_project(client, world)
    await restrict(client, world, project)
    keep = [editable(s) for s in project["statuses"] if s["name"] != "In Review"]

    response = await client.put(
        f"/projects/{project['id']}/statuses",
        json={"statuses": keep},
        headers=auth_headers(world.manager),
    )

    transitions = response.json()["transitions"]
    review = status_id(project, "In Review")
    assert review not in transitions
    assert all(review not in targets for targets in transitions.values())


async def test_wip_limits_are_stored_on_statuses(client: AsyncClient, world: World) -> None:
    project = await setup_project(client, world)
    statuses = [
        {**editable(item), "wip_limit": 3 if item["name"] == "In Progress" else None}
        for item in project["statuses"]
    ]

    response = await client.put(
        f"/projects/{project['id']}/statuses",
        json={"statuses": statuses},
        headers=auth_headers(world.manager),
    )

    limits = {s["name"]: s["wip_limit"] for s in response.json()["statuses"]}
    assert limits["In Progress"] == 3
    assert limits["To Do"] is None


async def test_bulk_update_changes_many_and_reports_per_issue_failures(
    client: AsyncClient, world: World
) -> None:
    project = await setup_project(client, world)
    mine = await api_create_task(client, world.member, project["id"], title="Mine")
    theirs = await api_create_task(client, world.other_member, project["id"], title="Theirs")

    response = await client.post(
        f"/projects/{project['id']}/tasks/bulk",
        json={"task_ids": [mine["id"], theirs["id"]], "changes": {"priority": "urgent"}},
        headers=auth_headers(world.member),
    )
    refreshed = await client.get(f"/tasks/{mine['id']}", headers=auth_headers(world.member))

    body = response.json()
    assert body["succeeded"] == 1
    assert [item["task_id"] for item in body["failed"]] == [theirs["id"]]
    assert body["failed"][0]["code"] == "permission_denied"
    assert refreshed.json()["priority"] == "urgent"


async def test_bulk_move_assign_and_delete_as_manager(client: AsyncClient, world: World) -> None:
    project = await setup_project(client, world)
    first = await api_create_task(client, world.member, project["id"])
    second = await api_create_task(client, world.member, project["id"])
    ids = [first["id"], second["id"]]

    assigned = await client.post(
        f"/projects/{project['id']}/tasks/bulk",
        json={
            "task_ids": ids,
            "changes": {
                "assignee_id": str(world.other_member.pk),
                "status_id": status_id(project, "In Progress"),
            },
        },
        headers=auth_headers(world.manager),
    )
    deleted = await client.post(
        f"/projects/{project['id']}/tasks/bulk",
        json={"task_ids": ids, "delete": True},
        headers=auth_headers(world.manager),
    )
    gone = await client.get(f"/tasks/{first['id']}", headers=auth_headers(world.manager))

    assert assigned.json() == {"succeeded": 2, "failed": []}
    assert deleted.json()["succeeded"] == 2
    assert gone.status_code == 404


async def test_bulk_requires_one_action_and_stays_in_the_project(
    client: AsyncClient, world: World
) -> None:
    project = await setup_project(client, world)
    other = await api_create_project(client, world.manager)
    foreign = await api_create_task(client, world.manager, other["id"])
    own = await api_create_task(client, world.manager, project["id"])

    both = await client.post(
        f"/projects/{project['id']}/tasks/bulk",
        json={"task_ids": [own["id"]], "changes": {"priority": "low"}, "delete": True},
        headers=auth_headers(world.manager),
    )
    none = await client.post(
        f"/projects/{project['id']}/tasks/bulk",
        json={"task_ids": [own["id"]]},
        headers=auth_headers(world.manager),
    )
    cross = await client.post(
        f"/projects/{project['id']}/tasks/bulk",
        json={"task_ids": [foreign["id"]], "delete": True},
        headers=auth_headers(world.manager),
    )
    viewer = await client.post(
        f"/projects/{project['id']}/tasks/bulk",
        json={"task_ids": [own["id"]], "changes": {"priority": "low"}},
        headers=auth_headers(world.viewer),
    )

    assert both.status_code == none.status_code == 422
    assert cross.json()["failed"][0]["code"] == "task_not_found"
    assert viewer.json()["failed"][0]["code"] == "permission_denied"


async def test_clone_copies_fields_and_links_back_to_the_original(
    client: AsyncClient, world: World
) -> None:
    project = await setup_project(client, world)
    original = await api_create_task(
        client,
        world.manager,
        project["id"],
        title="Checkout bug",
        issue_type="bug",
        priority="high",
        story_points=5,
        original_estimate_minutes=120,
        assignee_id=str(world.member.pk),
    )
    await client.post(
        f"/tasks/{original['id']}/worklogs",
        json={"minutes": 30},
        headers=auth_headers(world.member),
    )

    response = await client.post(
        f"/tasks/{original['key']}/clone", headers=auth_headers(world.manager)
    )
    links = await client.get(
        f"/tasks/{response.json()['id']}/links", headers=auth_headers(world.manager)
    )

    clone = response.json()
    assert response.status_code == 201
    assert clone["title"] == "CLONE - Checkout bug"
    assert clone["issue_type"] == "bug"
    assert clone["priority"] == "high"
    assert clone["story_points"] == 5
    assert clone["time_spent_minutes"] == 0
    assert clone["key"] != original["key"]
    assert links.json()[0]["label"] == "clones"
    assert links.json()[0]["issue"]["key"] == original["key"]


async def test_viewers_cannot_clone(client: AsyncClient, world: World) -> None:
    project = await setup_project(client, world)
    task = await api_create_task(client, world.manager, project["id"])

    response = await client.post(f"/tasks/{task['id']}/clone", headers=auth_headers(world.viewer))

    assert response.status_code == 403


async def test_rich_text_descriptions_are_sanitised_but_plain_text_is_kept(
    client: AsyncClient, world: World
) -> None:
    project = await setup_project(client, world)
    rich = await api_create_task(
        client,
        world.manager,
        project["id"],
        description='<p onclick="x()">Hi</p><script>alert(1)</script><a href="javascript:evil()">l</a>',
    )
    plain = await api_create_task(
        client, world.manager, project["id"], description="1 < 2 and 3 > 2\nsecond line"
    )

    updated = await client.patch(
        f"/tasks/{plain['id']}",
        json={"description": "<h2>Plan</h2><img src=x onerror=alert(1)>"},
        headers=auth_headers(world.manager),
    )

    assert "script" not in rich["description"] and "onclick" not in rich["description"]
    assert "javascript:" not in rich["description"]
    assert plain["description"] == "1 < 2 and 3 > 2\nsecond line"
    assert "onerror" not in updated.json()["description"]
    assert "<h2>Plan</h2>" in updated.json()["description"]
