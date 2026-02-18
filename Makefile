.PHONY: install update-db lint

install:
	npm install

update-db:
	npm run update:db

lint:
	npm run lint
