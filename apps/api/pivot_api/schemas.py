from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    """REST response model serialized with camelCase keys."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
