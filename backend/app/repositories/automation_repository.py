from beanie import PydanticObjectId

from app.models.automation_rule import AutomationRule, AutomationTrigger
from app.repositories.base import ASC, BaseRepository


class AutomationRepository(BaseRepository[AutomationRule]):
    def __init__(self) -> None:
        super().__init__(AutomationRule)

    async def list_for_project(self, project_id: PydanticObjectId) -> list[AutomationRule]:
        return (
            await AutomationRule.find({"project_id": project_id})
            .sort([("created_at", ASC)])
            .to_list()
        )

    async def enabled_for_trigger(
        self, project_id: PydanticObjectId, trigger: AutomationTrigger
    ) -> list[AutomationRule]:
        return await AutomationRule.find(
            {"project_id": project_id, "enabled": True, "trigger": trigger.value}
        ).to_list()

    async def delete_by_project(self, project_id: PydanticObjectId) -> None:
        await AutomationRule.find({"project_id": project_id}).delete()


automation_repository = AutomationRepository()
