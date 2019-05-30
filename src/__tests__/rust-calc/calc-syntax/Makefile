rust_plugin_sources := $(wildcard ../../../plugins/rust/*.js) \
               $(wildcard ../../../plugins/rust/lr/*.js) \
               $(wildcard ../../../plugins/rust/templates/*.rs)

src/lib.rs: ../../../../examples/calc.rs.g ../../../../dist/bin/syntax.js $(rust_plugin_sources)
	mkdir -p $(@D)
	../../../../bin/syntax -g $< -m LALR1 -o $@

../../../../dist/bin/syntax.js: $(rust_plugin_sources)
	npm run build