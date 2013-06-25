TESTS = test/*.test.js
TIMEOUT = 200000

test:
	@NODE_ENV=test ./node_modules/mocha/bin/mocha \
		--timeout $(TIMEOUT) \
		$(TESTS)


.PHONY: test