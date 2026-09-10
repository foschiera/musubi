#include "../src/domain/graph.hpp"
#include <cassert>
#include <iostream>
int main() {
    using namespace musubi;
    std::set<std::string> nodes{"a", "b", "c", "d", "z"};
    std::vector<Edge> edges{{"ab", "a", "b", 5, true}, {"bd", "b", "d", 5, true},
                            {"ad", "a", "d", 1, true}, {"ac", "a", "c", 5, true},
                            {"cd", "c", "d", 5, true}, {"ba", "b", "a", 5, true}};
    auto hops = path(nodes, edges, "a", "d", false);
    assert(hops.found && hops.cost == 1 && hops.edges == std::vector<std::string>{"ad"});
    auto weighted = path(nodes, edges, "a", "d", true);
    assert(weighted.found && weighted.cost == 2 &&
           weighted.events == std::vector<std::string>({"a", "b", "d"}));
    assert(!path(nodes, edges, "d", "a", false).found);
    assert(!path(nodes, edges, "a", "z", false).found);
    assert(!path({}, edges, "a", "d", false).found);
    assert(path(nodes, edges, "a", "a", false).cost == 0);
    assert(
        !path({"a", "d"}, {{"ab", "a", "b", 5, true}, {"bd", "b", "d", 5, true}}, "a", "d", false)
             .found);
    assert(path(nodes, {{"ad", "a", "d", 5, false}}, "d", "a", false).found);
    std::reverse(edges.begin(), edges.end());
    assert(path(nodes, edges, "a", "d", true).events == weighted.events);
    std::cout << "Graph tests passed: shortest path, weights, lexical tie, cycles, direction, "
                 "filters, empty and identity\n";
}
