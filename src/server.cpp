#include "domain/graph.hpp"
#include "httplib/httplib.h"
#include "nlohmann/json.hpp"
#include <atomic>
#include <chrono>
#include <fstream>
#include <iostream>
#include <regex>
using json = nlohmann::json;
struct InputError : std::runtime_error {
    using runtime_error::runtime_error;
};
std::string dateBound(const std::string &value, bool upper) {
    if (!std::regex_match(value, std::regex("[0-9]{4}(-[0-9]{2}(-[0-9]{2})?)?")))
        throw InputError("Invalid date format");
    int year = std::stoi(value.substr(0, 4));
    unsigned month = value.size() >= 7 ? std::stoul(value.substr(5, 2)) : (upper ? 12 : 1);
    if (year < 1 || month < 1 || month > 12)
        throw InputError("Invalid date");
    auto last = std::chrono::year_month_day_last(
        std::chrono::year(year), std::chrono::month_day_last(std::chrono::month(month)));
    unsigned day =
        value.size() == 10 ? std::stoul(value.substr(8, 2)) : (upper ? unsigned(last.day()) : 1);
    if (!std::chrono::year_month_day(std::chrono::year(year), std::chrono::month(month),
                                     std::chrono::day(day))
             .ok())
        throw InputError("Invalid calendar date");
    char buffer[32];
    std::snprintf(buffer, sizeof(buffer), "%04d-%02u-%02u", year, month, day);
    return buffer;
}
json read(const std::string &dir, const std::string &name) {
    std::ifstream f(dir + "/" + name + ".json");
    if (!f)
        throw std::runtime_error("Cannot read " + name);
    return json::parse(f);
}
std::string env(const char *key, const char *fallback) {
    auto p = std::getenv(key);
    return p ? p : fallback;
}
std::vector<std::string> split(const std::string &s) {
    std::vector<std::string> v;
    std::stringstream stream(s);
    std::string x;
    while (std::getline(stream, x, ','))
        if (!x.empty())
            v.push_back(x);
    return v;
}
bool intersects(const json &values, const std::vector<std::string> &filter) {
    if (filter.empty())
        return true;
    for (const auto &v : values)
        if (std::find(filter.begin(), filter.end(), v.get<std::string>()) != filter.end())
            return true;
    return false;
}
int main(int argc, char **argv) {
    try {
        const auto dir = argc > 2 && std::string(argv[1]) == "--validate"
                             ? std::string(argv[2])
                             : env("MUSUBI_DATASET_DIR", "data/demo");
        auto events = read(dir, "events"), edges = read(dir, "relationships"),
             sources = read(dir, "sources"), meta = read(dir, "taxonomies"),
             manifest = read(dir, "dataset_manifest");
        if (manifest.at("schema_version") != "1.0")
            throw std::runtime_error("Unsupported dataset schema version");
        std::set<std::string> ids, sourceids, regionids, perspectiveids, edgeids;
        for (const auto &r : meta.at("regions"))
            regionids.insert(r.at("id"));
        for (const auto &p : meta.at("perspectives"))
            perspectiveids.insert(p.at("id"));
        for (const auto &s : sources) {
            if (!sourceids.insert(s.at("id")).second)
                throw std::runtime_error("Duplicate source");
            if (!s.at("url").is_null() && !s.at("url").get<std::string>().starts_with("https://"))
                throw std::runtime_error("Invalid source URL");
        }
        auto refs = [&](const json &value, const std::set<std::string> &valid) {
            if (!value.is_array() || value.empty())
                throw std::runtime_error("Empty reference list");
            for (const auto &id : value)
                if (!valid.contains(id.get<std::string>()))
                    throw std::runtime_error("Unresolved reference: " + id.dump());
        };
        for (const auto &e : events) {
            if (!ids.insert(e.at("id")).second)
                throw std::runtime_error("Duplicate event");
            refs(e.at("source_ids"), sourceids);
            refs(e.at("region_ids"), regionids);
            if (e.at("narratives").empty())
                throw std::runtime_error("Missing narratives");
            if (e.at("title").get<std::string>().empty() ||
                e.at("date").at("start") > e.at("date").at("end"))
                throw std::runtime_error("Invalid event");
            dateBound(e.at("date").at("start"), false);
            dateBound(e.at("date").at("end"), true);
            for (const auto &n : e.at("narratives")) {
                refs(n.at("source_ids"), sourceids);
                if (!perspectiveids.contains(n.at("perspective_id")))
                    throw std::runtime_error("Unknown perspective");
            }
        }
        std::set<std::tuple<std::string, std::string, std::string>> triples;
        for (const auto &e : edges) {
            auto a = e.at("source_event_id").get<std::string>(),
                 b = e.at("target_event_id").get<std::string>(),
                 type = e.at("type").get<std::string>();
            if (!edgeids.insert(e.at("id")).second || !ids.contains(a) || !ids.contains(b) ||
                a == b || !triples.insert({a, b, type}).second)
                throw std::runtime_error("Invalid relationship endpoints or duplicate");
            if (e.at("confidence").get<int>() < 1 || e.at("confidence").get<int>() > 5)
                throw std::runtime_error("Invalid confidence");
            if (e.at("directed").get<bool>() != (type != "contemporary_with"))
                throw std::runtime_error("Invalid direction");
            refs(e.at("source_ids"), sourceids);
            refs(e.at("perspective_ids"), perspectiveids);
        }
        if (argc > 1 && std::string(argv[1]) == "--validate") {
            std::cout << "Validated " << events.size() << " events and " << edges.size()
                      << " relationships\n";
            return 0;
        }
        std::sort(events.begin(), events.end(),
                  [](const json &a, const json &b) { return a["id"] < b["id"]; });
        auto filter = [&](const json &f) {
            for (auto it = f.begin(); it != f.end(); ++it)
                if (!std::set<std::string>{"region_ids", "perspective_ids", "relationship_types",
                                           "from", "to", "q", "limit"}
                         .contains(it.key()))
                    throw InputError("Unknown filter: " + it.key());
            auto regions = f.value("region_ids", std::vector<std::string>{}),
                 perspectives = f.value("perspective_ids", std::vector<std::string>{}),
                 types = f.value("relationship_types", std::vector<std::string>{});
            for (auto &r : regions)
                if (!regionids.contains(r))
                    throw InputError("Unknown region");
            for (auto &p : perspectives)
                if (!perspectiveids.contains(p))
                    throw InputError("Unknown perspective");
            for (auto &t : types)
                if (!intersects(meta["relationship_types"], {t}))
                    throw InputError("Unknown relationship type");
            std::string from = f.contains("from") && !f["from"].is_null()
                                   ? f["from"].get<std::string>()
                                   : "",
                        to = f.contains("to") && !f["to"].is_null() ? f["to"].get<std::string>()
                                                                    : "";
            if (!from.empty())
                from = dateBound(from, false);
            if (!to.empty())
                to = dateBound(to, true);
            if (!from.empty() && !to.empty() && from > to)
                throw InputError("Start date must precede end date");
            auto lower = [](std::string s) {
                std::transform(s.begin(), s.end(), s.begin(),
                               [](unsigned char c) { return std::tolower(c); });
                return s;
            };
            auto q = lower(f.value("q", std::string{}));
            json ns = json::array(), es = json::array();
            std::set<std::string> kept;
            for (const auto &e : events) {
                json ps = json::array();
                for (const auto &n : e["narratives"])
                    ps.push_back(n["perspective_id"]);
                if (!intersects(e["region_ids"], regions) || !intersects(ps, perspectives))
                    continue;
                if (!from.empty() && dateBound(e["date"]["end"], true) < from)
                    continue;
                if (!to.empty() && dateBound(e["date"]["start"], false) > to)
                    continue;
                if (!q.empty() &&
                    lower(e["title"].get<std::string>() + " " + e["summary"].get<std::string>())
                            .find(q) == std::string::npos)
                    continue;
                if (!types.empty()) {
                    bool ok = false;
                    for (const auto &edge : edges)
                        if ((edge["source_event_id"] == e["id"] ||
                             edge["target_event_id"] == e["id"]) &&
                            intersects(json::array({edge["type"]}), types))
                            ok = true;
                    if (!ok)
                        continue;
                }
                ns.push_back(e);
            }
            int limit = f.value("limit", 500);
            if (limit < 1 || limit > 2000)
                throw InputError("Limit must be between 1 and 2000");
            bool truncated = ns.size() > static_cast<size_t>(limit);
            if (truncated)
                ns.erase(ns.begin() + limit, ns.end());
            for (const auto &e : ns)
                kept.insert(e["id"]);
            for (const auto &e : edges)
                if (kept.contains(e["source_event_id"]) && kept.contains(e["target_event_id"]) &&
                    intersects(e["perspective_ids"], perspectives) &&
                    intersects(json::array({e["type"]}), types))
                    es.push_back(e);
            return json{{"nodes", ns}, {"edges", es}, {"truncated", truncated}};
        };
        httplib::Server server;
        server.set_payload_max_length(16384);
        server.set_read_timeout(5);
        server.set_write_timeout(5);
        std::atomic<unsigned long> counter{0};
        auto send = [](httplib::Response &res, const json &j) {
            res.set_content(j.dump(), "application/json; charset=utf-8");
        };
        auto wrap = [&](auto fn) {
            return [&, fn](const httplib::Request &req, httplib::Response &res) {
                auto id = "req_" + std::to_string(++counter);
                try {
                    fn(req, res);
                } catch (const InputError &e) {
                    res.status = 400;
                    send(res, {{"error",
                                {{"code", "INVALID_FILTER"},
                                 {"message", e.what()},
                                 {"request_id", id}}}});
                } catch (const json::exception &) {
                    res.status = 400;
                    send(res, {{"error",
                                {{"code", "INVALID_REQUEST"},
                                 {"message", "Invalid JSON or field type"},
                                 {"request_id", id}}}});
                } catch (const std::exception &) {
                    res.status = 500;
                    send(res, {{"error",
                                {{"code", "INTERNAL_ERROR"},
                                 {"message", "Unexpected error"},
                                 {"request_id", id}}}});
                }
                res.set_header("X-Request-ID", id);
            };
        };
        server.Get("/health", wrap([&](const auto &, auto &res) {
                       send(res, {{"status", "ok"}, {"dataset_version", manifest["version"]}});
                   }));
        server.Get("/api/v1/meta", wrap([&](const auto &, auto &res) {
                       auto m = meta;
                       m["dataset_version"] = manifest["version"];
                       m["editorial_note"] = manifest["editorial_note"];
                       m["sources"] = sources;
                       send(res, m);
                   }));
        auto query = [&](const httplib::Request &req) {
            json f = json::object();
            for (const auto &[k, v] : req.params) {
                if (k == "region")
                    f["region_ids"] = split(v);
                else if (k == "perspective")
                    f["perspective_ids"] = split(v);
                else if (k == "relationship_type")
                    f["relationship_types"] = split(v);
                else if (k == "from" || k == "to" || k == "q")
                    f[k] = v;
                else if (k == "limit") {
                    if (!std::regex_match(v, std::regex("[0-9]{1,4}")))
                        throw InputError("Invalid limit");
                    f[k] = std::stoi(v);
                } else if (k != "cursor")
                    throw InputError("Unknown parameter: " + k);
            }
            return f;
        };
        server.Get("/api/v1/graph", wrap([&](const auto &req, auto &res) {
                       if (req.has_param("cursor"))
                           throw InputError("Graph does not accept cursor");
                       send(res, filter(query(req)));
                   }));
        server.Get("/api/v1/events", wrap([&](const auto &req, auto &res) {
                       auto f = query(req);
                       int limit = f.value("limit", 50);
                       if (limit < 1 || limit > 200)
                           throw InputError("List limit must be between 1 and 200");
                       f["limit"] = 2000;
                       auto ns = filter(f)["nodes"];
                       size_t start = 0;
                       if (req.has_param("cursor")) {
                           auto c = req.get_param_value("cursor");
                           auto it = std::find_if(ns.begin(), ns.end(),
                                                  [&](const auto &e) { return e["id"] == c; });
                           if (it == ns.end())
                               throw InputError("Invalid cursor");
                           start = std::distance(ns.begin(), it) + 1;
                       }
                       json items = json::array();
                       size_t end = std::min(ns.size(), start + limit);
                       for (size_t i = start; i < end; ++i)
                           items.push_back(ns[i]);
                       send(res,
                            {{"items", items},
                             {"total", ns.size()},
                             {"next_cursor", end < ns.size() ? ns[end - 1]["id"] : json(nullptr)}});
                   }));
        server.Get(
            "/api/v1/events/([a-z0-9_]+)", wrap([&](const auto &req, auto &res) {
                for (const auto &[k, v] : req.params)
                    if (k != "language")
                        throw InputError("Unknown parameter");
                for (auto e : events)
                    if (e["id"] == req.matches[1].str()) {
                        json ss = json::array();
                        std::set<std::string> refs;
                        for (const auto &s : e["source_ids"])
                            refs.insert(s);
                        for (const auto &n : e["narratives"])
                            for (const auto &s : n["source_ids"])
                                refs.insert(s);
                        for (const auto &s : sources)
                            if (refs.contains(s["id"]))
                                ss.push_back(s);
                        e["sources"] = ss;
                        if (req.has_param("language"))
                            std::stable_sort(
                                e["narratives"].begin(), e["narratives"].end(),
                                [&](const auto &a, const auto &b) {
                                    return (a["language"] == req.get_param_value("language")) >
                                           (b["language"] == req.get_param_value("language"));
                                });
                        send(res, e);
                        return;
                    }
                res.status = 404;
                send(res,
                     {{"error", {{"code", "EVENT_NOT_FOUND"}, {"message", "Event not found"}}}});
            }));
        server.Post(
            "/api/v1/paths", wrap([&](const auto &req, auto &res) {
                auto body = json::parse(req.body);
                auto from = body.at("from_event_id").template get<std::string>(),
                     to = body.at("to_event_id").template get<std::string>(),
                     strategy = body.value("strategy", std::string("fewest_hops"));
                if (strategy != "fewest_hops" && strategy != "highest_confidence")
                    throw InputError("Unknown strategy");
                if (!ids.contains(from) || !ids.contains(to)) {
                    res.status = 404;
                    send(res, {{"error",
                                {{"code", "EVENT_NOT_FOUND"}, {"message", "Event not found"}}}});
                    return;
                }
                auto g = filter(body.value("filters", json::object()));
                std::set<std::string> nodes;
                std::vector<musubi::Edge> links;
                for (const auto &e : g["nodes"])
                    nodes.insert(e["id"]);
                for (const auto &e : g["edges"])
                    links.push_back({e["id"], e["source_event_id"], e["target_event_id"],
                                     e["confidence"], e["directed"]});
                auto r = musubi::path(nodes, links, from, to, strategy == "highest_confidence");
                send(res,
                     {{"found", r.found},
                      {"strategy", strategy},
                      {"total_cost", r.found ? json(r.cost) : json(nullptr)},
                      {"events", r.events},
                      {"relationships", r.edges},
                      {"reason", r.found ? json(nullptr) : json("no_path_in_filtered_graph")}});
            }));
        server.set_error_handler([&](const auto &req, auto &res) {
            if (req.path.starts_with("/api/") && res.body.empty())
                send(res,
                     {{"error",
                       {{"code", "INVALID_REQUEST"}, {"message", "Unknown endpoint or method"}}}});
        });
        server.set_mount_point("/", "dist");
        auto port = std::stoi(env("MUSUBI_PORT", "8080"));
        if (port < 1 || port > 65535)
            throw std::runtime_error("Invalid port");
        if (!server.bind_to_port(env("MUSUBI_HOST", "127.0.0.1"), port))
            throw std::runtime_error("Unable to listen on configured address");
        std::cout << "Musubi running at http://" << env("MUSUBI_HOST", "127.0.0.1") << ":" << port
                  << std::endl;
        server.listen_after_bind();
    } catch (const std::exception &e) {
        std::cerr << e.what() << '\n';
        return 1;
    }
}
