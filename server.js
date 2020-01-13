/*
File: server.js
Purpose: to server device and location related updates to multiple clients
connection: websocket for device updates and notifications
REST end point: http://localhost:3001/polygon?name=${name}&lat=${lat}&long=${lng}`
REST api will return rectangle coordinates to the caller.
programmer: Kuldeep Bora
Date modified: 13/01/2020 
*/

// global variables
const express = require("express");
const socketIO = require("socket.io");
const http = require("http");
const port = process.env.PORT || 3000;
var app = express();
let server = http.createServer(app);
var io = socketIO(server);

//initial devices locations
let devices_start = [
  { name: "Device 1", lat: 35.0381234, long: 32.5811234 },
  { name: "Device 2", lat: 34.8481234, long: 32.6811234 },
  { name: "Device 3", lat: 34.9581234, long: 33.0811234 },
  { name: "Device 4", lat: 35.0681234, long: 33.4811234 },
  { name: "Device 5", lat: 35.0781234, long: 33.5511234 }
];

let polygons = []; //GEOJSON data structure to store areas
let notifications = []; // data structure to store notifications

let devices = JSON.parse(JSON.stringify(devices_start)); //deep copy from initial devices array

let int; //global handler for setInterval call, it will be reset upon request

//update devices location by 0.01 units and send updates to client every 5 sec
function sendDeviceUpdates(socket, dur) {
  int = setInterval(() => {
    devices.forEach(item => {
      let rand = Math.random();
      let add = rand < 0.5 ? rand * 0.01 * -1 : rand * 0.01;
      //Math.random() < 0.5 ? -1 : 1;
      item.lat = item.lat + add;
      item.long = item.long + add;
    });
    socket.emit("deviceUpdates", devices);
    populateNotifications(socket);
  }, dur);
}

//Reset devices locations to initial, clear old interval and create new interval
function resetDevices(socket, dur) {
  //reset device locations to intitial
  clearInterval(int);
  devices = JSON.parse(JSON.stringify(devices_start));
  int = setInterval(() => {
    devices.forEach(item => {
      let rand = Math.random();
      let add = rand < 0.5 ? rand * 0.004 * -1 : rand * 0.005;
      //Math.random() < 0.5 ? -1 : 1;
      item.lat = item.lat + add;
      item.long = item.long + add;
    });
    socket.emit("deviceUpdates", devices);
    populateNotifications(socket);
  }, dur);
}

//Populate two kinds of  notifications: 1. proximity, 2. Area entered
//the function also calls emit call to send notifications
function populateNotifications(socket) {
  notifications = [];
  devices.forEach(device => {
    devices.forEach(item => {
      if (
        device.name != item.name &&
        notifications.some(
          item => item.device1 == device.name || item.device2 == device.name
        ) == false
      ) {
        //console.log(device.name, item.name);
        let dist = getDistance(device.lat, device.long, item.lat, item.long);
        //console.log("distance: ", dist);
        if (dist <= 10)
          notifications.push({
            type: "Proximity",
            // device: "dummy",
            device1: `${device.name}`,
            device2: `${item.name}`,
            text: `${device.name} is too close to ${item.name}`
          });
      }
    });

    polygons.forEach(area => {
      if (checkCloseness(device, area)) {
        //console.log("device: ", device.name, "inside: ", area.properties.name);
        //console.log("notifications: : ", notifications);
        let itemFound = notifications.findIndex(
          item => item.device == device.name
        );
        //console.log("item found? ", itemFound);
        if (itemFound != -1)
          notifications[itemFound].text += ", [" + area.properties.name + "]";
        else
          notifications.push({
            type: "entered",
            device: `${device.name}`,
            area: `${area.properties.name}`,
            text: `${device.name} entered Area - [${area.properties.name}]`
          });
      }
    });
  });
  socket.emit("notifications", notifications);
  socket.emit("areas", polygons);
}

//function to check if marker falls inside an area, returns boolean value
function checkCloseness(marker, poly) {
  let polyPoints = poly.geometry.coordinates[0];
  let x = marker.lat,
    y = marker.long;
  //console.log("check closeness: ", marker, " ,, ", polyPoints);

  let inside = false;
  for (let i = 0, j = 3; i < 4; j = i++) {
    let xi = polyPoints[i][0],
      yi = polyPoints[i][1];
    let xj = polyPoints[j][0],
      yj = polyPoints[j][1];

    let intersect =
      yi > y != yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
}

function degreesToRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

//function to check distance between two devices and return distance in km
function getDistance(lat1, lng1, lat2, lng2) {
  // The radius of the planet earth in meters
  let R = 6378137;
  let dLat = degreesToRadians(lat2 - lat1);
  let dLong = degreesToRadians(lng2 - lng1);
  let a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(degreesToRadians(lat1)) *
      Math.cos(degreesToRadians(lat1)) *
      Math.sin(dLong / 2) *
      Math.sin(dLong / 2);

  let c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  let distance = R * c;

  return distance / 1000;
}

// listen and send on web socket
io.on("connection", socket => {
  console.log("New user connected at: ", new Date());
  //emit message from server to user

  //send polygons at start
  socket.emit("areas", polygons);

  // listen for start message from user and then send device updates
  socket.on("start", newMessage => {
    sendDeviceUpdates(socket, 5000);
  });

  //remove areas
  socket.on("remove-areas", newMessage => {
    polygons = [];
  });

  //reset the devices locations
  socket.on("reset", newMessage => {
    //console.log("reset devices message recieved");
    resetDevices(socket, 5000);
  });

  // when server disconnects from user
  socket.on("disconnect", () => {
    console.log("disconnected from user");
  });
});

server.listen(port);

// REST api function

//Allow same origin requests
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  next();
});

app.get("/polygon", function(req, res) {
  let center = { lat: req.query.lat, long: req.query.long };
  let poly = {
    type: "Feature",
    properties: { name: req.query.name },
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [parseFloat(req.query.lat), parseFloat(req.query.long)],
          [parseFloat(req.query.lat) + 0.1332, parseFloat(req.query.long)],
          [
            parseFloat(req.query.lat) + 0.1332,
            parseFloat(req.query.long) + 0.1332 //0.08298
          ],
          [
            parseFloat(req.query.lat),
            parseFloat(req.query.long) + 0.1332 /* 0.08298 */
          ],
          [parseFloat(req.query.lat), parseFloat(req.query.long)]
        ]
      ]
    }
  };
  polygons.push(poly);
  //console.log("polygons[] : ", polygons);
  //console.log("Notifications[]: ", notifications);
  res.send(poly);
});

//Listen to REST call at port 3001
app.listen(3001);
