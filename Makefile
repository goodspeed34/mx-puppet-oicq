.PHONY = all gen run
O=out

node := node
npx := npx
yarn := yarn

all: ${O}/index.js ${O}/gen.js ${O}/fgen.js

clean:
	# rm -f .deps
	# rm -rf node_modules
	rm -f ${O}/*.js

fgen: ${O}/fgen.js
	${node} ${O}/fgen.js

gen: ${O}/gen.js
	${node} ${O}/gen.js

run: ${O}/index.js
	${node} ${O}/index.js

mgen: oicq-registration.yaml

config.yaml: ${O}/fgen.js
	${node} ${O}/fgen.js

oicq-registration.yaml: ${O}/index.js config.yaml
	${node} ${O}/index.js -r

%.js: .deps
	${npx} tsc --outDir ${O} source/$(basename $(@F)).ts

.deps:
	${npx} ${yarn} install
	touch .deps
