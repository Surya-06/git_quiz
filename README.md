# OLD CODE - UNMAINTAINED INITIAL VERSION

# GIT Test Engine

The first real time remote code testing platform for **GIT**.

## Instructions to run:

1. Download zip file of the project and extract it.
2. Install LTS version of Node JS.
3. Run  **npm install** to install all the dependencies from package.json.
4. Start the server using the command : **node server.js**
5. Configure file paths, extensions and other OS related settings in the file 'config.json'.
6. Acess the server from the location : **localhost:3000**

## NOTE:
1. The settings for allowed usernames and passwords can be done from 'config.json'.
2. Defaults are set for Windows , for linux please change delimiters and commands set in the environment.
3. For silent execution please set **DEBUG: false** in 'config.json'.
