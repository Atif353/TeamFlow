from beanie import Document, PydanticObjectId


class BaseDocument(Document):
    @property
    def pk(self) -> PydanticObjectId:
        if self.id is None:
            raise ValueError("Document has not been saved")
        return self.id
