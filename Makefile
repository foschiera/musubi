CXX ?= g++
CXXFLAGS ?= -std=c++20 -O2 -Wall -Wextra -pthread
DATASET ?= data/demo
.PHONY: setup build run test check validate-data
setup:
	npm ci --no-audit --no-fund
build: build/musubi
	npm run build
build/musubi: src/server.cpp src/domain/graph.hpp
	mkdir -p build
	$(CXX) $(CXXFLAGS) -Ivendor src/server.cpp -o $@
run: build validate-data
	./build/musubi
validate-data: build/musubi
	node scripts/validate-data.mjs $(DATASET)
	./build/musubi --validate $(DATASET)
test: build/musubi
	$(CXX) $(CXXFLAGS) tests/graph.cpp -o build/graph_test
	./build/graph_test
	python3 tests/api_test.py
check: build validate-data test
	npx prettier --check web index.html package.json tsconfig.json vite.config.js scripts schemas data tests/browser_smoke.cjs
