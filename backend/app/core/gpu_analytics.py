"""
GPU analytics wrapper.
Uses NVIDIA RAPIDS cuDF when ENABLE_GPU_ACCELERATION=true AND cuDF is installed.
Falls back transparently to pandas on CPU — zero code changes in callers.
"""
from __future__ import annotations
from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)
settings = get_settings()

_GPU_AVAILABLE = False
pd = None  # set below
np = None  # set below

if settings.ENABLE_GPU_ACCELERATION:
    try:
        import cudf as _cudf       # type: ignore
        import cupy as _cupy       # type: ignore
        pd = _cudf
        np = _cupy
        _GPU_AVAILABLE = True
        logger.info("NVIDIA RAPIDS cuDF loaded — GPU analytics enabled")
    except ImportError:
        import pandas as _pd
        import numpy as _np
        pd = _pd
        np = _np
        logger.info(
            "ENABLE_GPU_ACCELERATION=true but cuDF is not installed — "
            "falling back to pandas. Install NVIDIA RAPIDS to use GPU."
        )
    except Exception as e:
        import pandas as _pd
        import numpy as _np
        pd = _pd
        np = _np
        logger.warning("GPU init error (%s) — falling back to pandas", e)
else:
    import pandas as _pd
    import numpy as _np
    pd = _pd
    np = _np

GPU_AVAILABLE: bool = _GPU_AVAILABLE


def get_dataframe_engine() -> str:
    """Return the active dataframe engine name for display."""
    return "cuDF (GPU)" if _GPU_AVAILABLE else "pandas (CPU)"


def skills_frequency_df(skills_data: list) -> object:
    """Compute skill frequency table — GPU or CPU."""
    rows = []
    for item in skills_data:
        for skill in (item or []):
            name = (skill.get("name") or "").strip()
            if name:
                rows.append({"skill": name, "proficiency": skill.get("proficiency", "unknown")})
    df = pd.DataFrame(rows)
    if len(df) == 0:
        return pd.DataFrame({"skill": pd.Series(dtype=str), "count": pd.Series(dtype=int)})
    return (
        df.groupby("skill")
        .size()
        .reset_index(name="count")
        .sort_values("count", ascending=False)
    )


def experience_histogram(exp_values: list) -> object:
    """Bin experience values into labelled ranges — GPU or CPU."""
    valid = [v for v in exp_values if v is not None]
    if not valid:
        return pd.DataFrame({"range": pd.Series(dtype=str), "count": pd.Series(dtype=int)})
    import pandas as _pandas  # always use pandas for pd.cut (cuDF cut differs)
    df = _pandas.DataFrame({"years": valid})
    bins   = [0, 1, 3, 5, 8, 12, 100]
    labels = ["0-1", "1-3", "3-5", "5-8", "8-12", "12+"]
    df["range"] = _pandas.cut(df["years"], bins=bins, labels=labels, right=False)
    result = df.groupby("range", observed=True).size().reset_index(name="count")
    return result
