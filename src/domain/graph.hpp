#pragma once
#include <algorithm>
#include <map>
#include <queue>
#include <set>
#include <string>
#include <vector>
namespace musubi {
struct Edge {
    std::string id, from, to;
    int confidence;
    bool directed;
};
struct Route {
    bool found = false;
    int cost = 0;
    std::vector<std::string> events, edges;
};
inline Route path(const std::set<std::string> &nodes, const std::vector<Edge> &edges,
                  const std::string &from, const std::string &to, bool weighted) {
    if (!nodes.contains(from) || !nodes.contains(to))
        return {};
    struct State {
        int cost;
        std::vector<std::string> nodes, edges;
    };
    auto compare = [](const State &a, const State &b) {
        return std::tie(a.cost, a.nodes, a.edges) > std::tie(b.cost, b.nodes, b.edges);
    };
    std::priority_queue<State, std::vector<State>, decltype(compare)> queue(compare);
    std::map<std::string, std::vector<std::pair<std::string, Edge>>> adj;
    for (const auto &e : edges) {
        adj[e.from].push_back({e.to, e});
        if (!e.directed)
            adj[e.to].push_back({e.from, e});
    }
    std::set<std::string> visited;
    if (!weighted) {
        std::queue<State> bfs;
        for (auto &[id, neighbors] : adj)
            std::sort(neighbors.begin(), neighbors.end(), [](const auto &a, const auto &b) {
                return std::tie(a.first, a.second.id) < std::tie(b.first, b.second.id);
            });
        bfs.push({0, {from}, {}});
        visited.insert(from);
        while (!bfs.empty()) {
            auto s = bfs.front();
            bfs.pop();
            if (s.nodes.back() == to)
                return {true, s.cost, s.nodes, s.edges};
            for (const auto &[next, e] : adj[s.nodes.back()]) {
                if (!nodes.contains(next) || !visited.insert(next).second)
                    continue;
                auto candidate = s;
                ++candidate.cost;
                candidate.nodes.push_back(next);
                candidate.edges.push_back(e.id);
                bfs.push(candidate);
            }
        }
        return {};
    }
    queue.push({0, {from}, {}});
    while (!queue.empty()) {
        auto s = queue.top();
        queue.pop();
        const auto current = s.nodes.back();
        if (visited.contains(current))
            continue;
        visited.insert(current);
        if (current == to)
            return {true, s.cost, s.nodes, s.edges};
        for (const auto &[next, e] : adj[current])
            if (nodes.contains(next) && !visited.contains(next)) {
                auto candidate = s;
                candidate.cost += weighted ? 6 - e.confidence : 1;
                candidate.nodes.push_back(next);
                candidate.edges.push_back(e.id);
                queue.push(candidate);
            }
    }
    return {};
}
} // namespace musubi
