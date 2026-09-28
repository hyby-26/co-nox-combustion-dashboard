import dash
from dash import Input, Output, State, callback, clientside_callback, dcc, html
from dash.exceptions import PreventUpdate

from components import correlation, data_quality, distribution, overview, timeseries
from components.summary_tiles import build_summary_tiles
from data_loader import get_sensor_columns, get_years, load_data
from labels import display_name
from filters import filter_data

dash.register_page(__name__, path="/", name="대시보드")

df = load_data()
years = get_years(df)
sensor_columns = get_sensor_columns(df)
FULL_START = df["datetime"].min()
FULL_END = df["datetime"].max()

TAB_STYLE = {
    "padding": "14px 4px",
    "border": "none",
    "borderBottom": "2px solid transparent",
    "backgroundColor": "var(--bg)",
    "color": "var(--text-2)",
    "fontWeight": "500",
    "fontSize": "14px",
}
TAB_SELECTED_STYLE = {
    **TAB_STYLE,
    "borderBottom": "2px solid var(--co)",
    "color": "var(--text)",
    "fontWeight": "600",
}

layout = html.Div(
    [
        dcc.Store(id="applied-filters", data={"years": years, "columns": sensor_columns}),
        # Collapsible on narrow screens (see the clientside callback below); on desktop the
        # <summary> is hidden by CSS and the panel stays open as a regular sidebar.
        html.Details(
            [
                html.Summary("필터", className="sidebar-summary"),
                html.H3("필터"),
                html.Label("연도 선택"),
                dcc.Dropdown(
                    id="year-filter",
                    options=[{"label": str(y), "value": y} for y in years],
                    value=years,
                    multi=True,
                    clearable=True,
                ),
                html.Label("컬럼 선택"),
                dcc.Dropdown(
                    id="column-filter",
                    options=[{"label": display_name(c), "value": c} for c in sorted(sensor_columns)],
                    value=sensor_columns,
                    multi=True,
                    clearable=True,
                ),
                html.Button("적용", id="apply-filters", n_clicks=0, className="filter-apply-btn"),
                html.Span(id="pending-indicator", className="pending-indicator"),
            ],
            id="filter-panel",
            className="sidebar",
            open=True,
        ),
        html.Div(
            [
                html.Div(id="summary-tiles"),
                dcc.Tabs(
                    id="tabs",
                    value="tab-overview",
                    className="app-tabs",
                    # dcc.Tabs stacks vertically below 800px by default; keep one row and
                    # let style.css scroll it sideways instead.
                    mobile_breakpoint=0,
                    children=[
                        dcc.Tab(
                            label="개요",
                            value="tab-overview",
                            style=TAB_STYLE,
                            selected_style=TAB_SELECTED_STYLE,
                        ),
                        dcc.Tab(
                            label="분포",
                            value="tab-distribution",
                            style=TAB_STYLE,
                            selected_style=TAB_SELECTED_STYLE,
                        ),
                        dcc.Tab(
                            label="시계열",
                            value="tab-timeseries",
                            style=TAB_STYLE,
                            selected_style=TAB_SELECTED_STYLE,
                        ),
                        dcc.Tab(
                            label="상관관계",
                            value="tab-correlation",
                            style=TAB_STYLE,
                            selected_style=TAB_SELECTED_STYLE,
                        ),
                        dcc.Tab(
                            label="데이터 품질",
                            value="tab-quality",
                            style=TAB_STYLE,
                            selected_style=TAB_SELECTED_STYLE,
                        ),
                    ],
                ),
                html.Div(id="tab-content", children="준비 중", className="content-card"),
            ],
            className="main-panel",
        ),
    ],
    className="app-shell",
)


# Must match the max-width breakpoint in assets/style.css. Decided once per page load, so
# the filters start collapsed on phones without collapsing them on desktop.
clientside_callback(
    """
    function(_) {
        return !window.matchMedia('(max-width: 768px)').matches;
    }
    """,
    Output("filter-panel", "open"),
    Input("filter-panel", "id"),
)


@callback(
    Output("applied-filters", "data"),
    Input("apply-filters", "n_clicks"),
    State("year-filter", "value"),
    State("column-filter", "value"),
    prevent_initial_call=True,
)
def apply_filters(n_clicks, pending_years, pending_columns):
    if not pending_years or not pending_columns:
        raise PreventUpdate
    return {"years": pending_years, "columns": pending_columns}


@callback(
    Output("tab-content", "children"),
    Input("tabs", "value"),
    Input("applied-filters", "data"),
)
def update_tab_content(active_tab, applied_filters):
    filtered = filter_data(df, applied_filters["years"], applied_filters["columns"])

    if active_tab == "tab-overview":
        return overview.render(filtered, FULL_START, FULL_END)
    if active_tab == "tab-distribution":
        return distribution.render(filtered)
    if active_tab == "tab-timeseries":
        return timeseries.render(filtered)
    if active_tab == "tab-correlation":
        return correlation.render(filtered)
    if active_tab == "tab-quality":
        return data_quality.render(filtered)
    return "준비 중"


@callback(
    Output("summary-tiles", "children"),
    Input("applied-filters", "data"),
)
def update_summary_tiles(applied_filters):
    filtered = filter_data(df, applied_filters["years"], applied_filters["columns"])
    return build_summary_tiles(
        filtered, applied_filters["years"], applied_filters["columns"], sensor_columns
    )


@callback(
    Output("pending-indicator", "children"),
    Output("apply-filters", "disabled"),
    Input("year-filter", "value"),
    Input("column-filter", "value"),
    Input("applied-filters", "data"),
)
def update_pending_indicator(pending_years, pending_columns, applied_filters):
    pending_years = pending_years or []
    pending_columns = pending_columns or []
    if not pending_years or not pending_columns:
        return "연도와 컬럼을 1개 이상 선택해주세요", True
    is_pending = (
        sorted(pending_years) != sorted(applied_filters["years"])
        or sorted(pending_columns) != sorted(applied_filters["columns"])
    )
    return ("변경사항 있음 · 적용을 눌러주세요" if is_pending else ""), False
