to insert scripts in an existing repo:  

- copy "inject_scripts" folder in the root dir
- adds in  esbuild.config.mjs
	define: {
		'process.env.DEBUG': JSON.stringify(prod ? "false" : "true")
	},
- run the bat in "inject_scripts"
- you can then delete "inject_scripts" folder