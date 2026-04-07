"""
LangGraph StateGraph — Rakshak AI Crisis Response Graph
Nodes: detect_crisis → gather_intel → score_services → decide_dispatch → alert_venue
"""
from langgraph.graph import StateGraph, START, END

from .state import CrisisState
from .nodes.detect import detect_crisis
from .nodes.gather import gather_intel
from .nodes.score import score_services
from .nodes.decide import decide_dispatch
from .nodes.alert import alert_venue


def _should_alert(state: CrisisState) -> str:
    """
    Conditional edge after decide_dispatch.
    Alert if severity >= 6 OR threat level in ORANGE/RED/CRITICAL.
    """
    severity    = state.get("severity", 0)
    threat_level = state.get("threat_level", "GREEN")
    if severity >= 6 or threat_level in ("ORANGE", "RED", "CRITICAL"):
        return "alert"
    return "end"


def build_graph():
    g = StateGraph(CrisisState)

    g.add_node("detect_crisis",  detect_crisis)
    g.add_node("gather_intel",   gather_intel)
    g.add_node("score_services", score_services)
    g.add_node("decide_dispatch", decide_dispatch)
    g.add_node("alert_venue",    alert_venue)

    g.add_edge(START,            "detect_crisis")
    g.add_edge("detect_crisis",  "gather_intel")
    g.add_edge("gather_intel",   "score_services")
    g.add_edge("score_services", "decide_dispatch")
    g.add_conditional_edges(
        "decide_dispatch",
        _should_alert,
        {"alert": "alert_venue", "end": END},
    )
    g.add_edge("alert_venue", END)

    return g.compile()


# Compiled graph — imported by main.py
crisis_graph = build_graph()
