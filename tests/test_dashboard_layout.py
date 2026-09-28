from dash import dcc, html

import app  # noqa: F401  (instantiates Dash, which registers and imports pages)
from pages import dashboard


def _walk(component):
    yield component
    children = getattr(component, "children", None)
    if children is None or isinstance(children, (str, int, float)):
        return
    if not isinstance(children, (list, tuple)):
        children = [children]
    for child in children:
        yield from _walk(child)


def _find_by_id(layout, component_id):
    return next(c for c in _walk(layout) if getattr(c, "id", None) == component_id)


def test_tabs_stay_horizontal_on_narrow_screens():
    tabs = _find_by_id(dashboard.layout, "tabs")
    assert isinstance(tabs, dcc.Tabs)
    assert tabs.mobile_breakpoint == 0


def test_filter_panel_is_a_collapsible_details_with_summary():
    panel = _find_by_id(dashboard.layout, "filter-panel")
    assert isinstance(panel, html.Details)
    assert "sidebar" in panel.className
    assert any(isinstance(c, html.Summary) for c in panel.children)
