"""Tests for the UI UX Pro Max MCP server.

Run from the repo root:
    uv run --with mcp==2.2.0 --with pytest pytest mcp/uiux_pro_max_mcp/tests
"""

import json
import sys
from pathlib import Path

import pytest

SERVER_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVER_DIR))

import server  # noqa: E402
from mcp import Client, StdioServerParameters  # noqa: E402

pytestmark = pytest.mark.anyio


@pytest.fixture
def anyio_backend():
    return "asyncio"


async def call(name, args):
    async with Client(server.mcp) as client:
        return await client.call_tool(name, args)


def text(result):
    return result.content[0].text


async def test_lists_all_tools_with_annotations():
    async with Client(server.mcp) as client:
        tools = {t.name: t for t in (await client.list_tools()).tools}

    assert set(tools) == {
        "uiux_generate_design_system", "uiux_save_design_system",
        "uiux_search", "uiux_search_stack", "uiux_get_catalog",
    }
    for name, tool in tools.items():
        assert tool.description, name
        assert tool.annotations.open_world_hint is False, name
        expected_read_only = name != "uiux_save_design_system"
        assert tool.annotations.read_only_hint is expected_read_only, name
    assert tools["uiux_save_design_system"].annotations.destructive_hint is True


async def test_generate_design_system_markdown():
    result = await call("uiux_generate_design_system", {
        "query": "hvac service booking", "project_name": "Sahaburapa",
    })
    assert not result.is_error
    assert text(result).startswith("## Design System: Sahaburapa")
    assert "Typography" in text(result)


async def test_generate_design_system_json_with_dials():
    result = await call("uiux_generate_design_system", {
        "query": "internal analytics dashboard", "variance": 8, "motion": 7, "density": 8,
        "response_format": "json",
    })
    assert not result.is_error
    data = json.loads(text(result))
    assert {"pattern", "style", "colors", "typography"} <= set(data)


async def test_search_domain_hit():
    result = await call("uiux_search", {"query": "back button navigation", "domain": "icons", "max_results": 1})
    assert not result.is_error
    assert "arrow-left" in text(result)


async def test_search_json_and_max_results():
    result = await call("uiux_search", {
        "query": "fintech", "domain": "color", "max_results": 2, "response_format": "json",
    })
    data = json.loads(text(result))
    assert data["domain"] == "color"
    assert 1 <= data["count"] <= 2
    assert data["count"] == len(data["results"])


async def test_search_no_match_is_not_an_error():
    result = await call("uiux_search", {"query": "zzqx unknownterm", "domain": "landing"})
    assert not result.is_error
    assert "Found:** 0 results" in text(result)
    assert "No matches" in text(result)


@pytest.mark.parametrize("stack", server.AVAILABLE_STACKS)
async def test_search_stack_every_stack(stack):
    result = await call("uiux_search_stack", {"query": "form accessibility", "stack": stack, "max_results": 1})
    assert not result.is_error, text(result)
    assert stack in text(result)


async def test_get_catalog():
    data = json.loads(text(await call("uiux_get_catalog", {})))
    assert {d["name"] for d in data["domains"]} == set(server.DOMAINS)
    assert len(data["stacks"]) == 22
    assert data["counts"]["stacks"] == 22


@pytest.mark.parametrize("args", [
    {"query": "x", "domain": "icons"},                      # query too short
    {"query": "fintech", "domain": "not-a-domain"},         # unknown domain
    {"query": "fintech", "domain": "color", "max_results": 50},
])
async def test_search_rejects_invalid_arguments(args):
    assert (await call("uiux_search", args)).is_error


async def test_dial_out_of_range_rejected():
    result = await call("uiux_generate_design_system", {"query": "saas dashboard", "density": 11})
    assert result.is_error


async def test_save_creates_master_and_page(tmp_path):
    result = await call("uiux_save_design_system", {
        "query": "hvac service booking", "project_name": "Sahaburapa Service",
        "output_dir": str(tmp_path), "page": "booking",
    })
    assert not result.is_error, text(result)
    data = json.loads(text(result))
    assert data["status"] == "success"
    base = tmp_path / "design-system" / "sahaburapa-service"
    assert (base / "MASTER.md").is_file()
    assert (base / "pages" / "booking.md").is_file()


async def test_save_never_overwrites_without_flag(tmp_path):
    args = {"query": "hvac service booking", "project_name": "Keep", "output_dir": str(tmp_path)}
    master = tmp_path / "design-system" / "keep" / "MASTER.md"

    await call("uiux_save_design_system", args)
    master.write_text("edited by hand", encoding="utf-8")

    data = json.loads(text(await call("uiux_save_design_system", args)))
    assert data["status"] == "skipped_exists"
    assert master.read_text(encoding="utf-8") == "edited by hand"

    # A new page is still added next to the untouched master.
    data = json.loads(text(await call("uiux_save_design_system", {**args, "page": "dashboard"})))
    assert data["created_files"] == [str(master.parent / "pages" / "dashboard.md")]
    assert master.read_text(encoding="utf-8") == "edited by hand"

    data = json.loads(text(await call("uiux_save_design_system", {**args, "overwrite": True})))
    assert data["status"] == "success"
    assert master.read_text(encoding="utf-8") != "edited by hand"


async def test_save_slugs_names_inside_output_dir(tmp_path):
    data = json.loads(text(await call("uiux_save_design_system", {
        "query": "saas dashboard", "project_name": "../../escape", "page": "../../evil",
        "output_dir": str(tmp_path),
    })))
    for path in data["created_files"]:
        assert Path(path).resolve().is_relative_to(tmp_path.resolve())


@pytest.mark.parametrize("output_dir", ["relative/path", "/definitely/not/here"])
async def test_save_rejects_bad_output_dir(output_dir):
    result = await call("uiux_save_design_system", {
        "query": "saas dashboard", "project_name": "X", "output_dir": output_dir,
    })
    assert result.is_error
    assert "output_dir" in text(result)


async def test_stdio_subprocess_end_to_end():
    """Launch the real server over stdio: catches anything that writes to stdout."""
    params = StdioServerParameters(command=sys.executable, args=[str(SERVER_DIR / "server.py")])
    async with Client(params) as client:
        tools = (await client.list_tools()).tools
        assert len(tools) == 5
        result = await client.call_tool("uiux_search", {"query": "fintech", "domain": "color", "max_results": 1})
        assert not result.is_error
        assert "Found:** 1 results" in text(result)
