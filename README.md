# Tracker-Server
A webserver for device tracker app

##install
```
npm install
```

##run
```
node server.js
```
#comments from server.js
```

File: server.js
Purpose: to server device and location related updates to multiple clients
connection: websocket for device updates and notifications
REST end point: http://localhost:3001/polygon?name=${name}&lat=${lat}&long=${lng}`
REST api will return rectangle coordinates to the caller.
programmer: Kuldeep Bora
Date modified: 13/01/2020 

```
