import logging
import sys


def configure_logging(environment: str) -> None:
    level = logging.INFO if environment == "production" else logging.DEBUG
    logging.basicConfig(
        level=level,
        stream=sys.stdout,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
        force=True,
    )
    logging.getLogger("uvicorn.access").setLevel(logging.INFO)
    logging.getLogger("pymongo").setLevel(logging.WARNING)
