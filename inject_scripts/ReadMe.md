to insert scripts in an existing repo:  

- copy "inject_scripts" folder in the root dir
- take care esbuild.config.mjs will be replaced to add
	define: {
		'process.env.DEBUG': JSON.stringify(prod ? "false" : "true")
	},
- npm i in "inject_scripts"
- run the bat in "inject_scripts"
- you can then delete "inject_scripts" folder