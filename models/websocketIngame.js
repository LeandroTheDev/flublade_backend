//Dependecies
const WebSocket = require("ws");
//Dependecies External
const worlds = require("./worlds");
const accounts = require("./accounts");

const wss = new WebSocket.Server({ port: 8081 });
//Variables
let playersOnline = {};
let map = {};
let mapEvents = {};

//Enemy moving function
function enemyMoving(positionX, positionY, epositionX, epositionY) {
    const moveSpeed = 0.18;
    let directionX = "Direction.idle";
    let directionY = "Direction.idle";
    let moviment = [false, false, false, false];
    //X direction
    if (positionX < epositionX) {
        //Deadzone move
        if (epositionX - positionX >= 1) {
            directionX = "Direction.left";
            moviment[0] = true;
        }
        epositionX -= moveSpeed;
    } else if (positionX > epositionX) {
        //Deadzone move
        if (positionX - epositionX >= 1) {
            directionX = "Direction.right";
            moviment[1] = true;
        }
        epositionX += moveSpeed;
    }
    //Y direction
    if (positionY < epositionY) {
        //Deadzone move
        if (epositionY - positionY >= 1) {
            directionY = "Direction.up";
            moviment[2] = true;
        }
        epositionY -= moveSpeed;
    } else if (positionY > epositionY) {
        //Deadzone move
        if (positionY - epositionY >= 1) {
            directionY = "Direction.down";
            moviment[3] = true;
        }
        epositionY += moveSpeed;
    }
    //Movement Reducer
    if (true) {
        //Left moviment
        if (moviment[0] && (moviment[2] || moviment[3])) {
            if (positionX < epositionX) {
                epositionX += moveSpeed / 2;
            } else {
                epositionX -= moveSpeed / 2;
            }
        }
        //Right moviment
        if (moviment[1] && (moviment[2] || moviment[3])) {
            if (positionX < epositionX) {
                epositionX += moveSpeed / 2;
            } else {
                epositionX -= moveSpeed / 2;
            }
        }

    }
    //Parse to client Direction
    let direction;
    if (directionX != "Direction.idle" || directionY != "Direction.idle") {
        //X & Y Directions
        if (directionX != "Direction.idle") {
            //Right
            if (directionX == "Direction.right") {
                if (directionY == "Direction.up") {
                    direction = "Direction.upRight";
                } else if (directionY == "Direction.down") {
                    direction = "Direction.downRight";
                } else {
                    direction = "Direction.right";
                }
            }
            //Left
            else if (directionX == "Direction.left") {
                if (directionY == "Direction.up") {
                    direction = "Direction.upLeft";
                } else if (directionY == "Direction.down") {
                    direction = "Direction.downLeft";
                } else {
                    direction = "Direction.left";
                }
            }
        }
        //Y Only Directions
        else if (directionY != "Direction.idle") {
            //Up
            if (directionY == "Direction.up") {
                direction = "Direction.up";
            }
            //Down
            if (directionY == "Direction.down") {
                direction = "Direction.down";
            }
        }
    }
    return [epositionX, epositionY, direction];
}

//If player is not newer of the selected enemy //Anti cheat
function checkIfPlayerIsNewerTheEnemy(map, location, id, enemyID) {
    let playerPositionX = map[location][id]['positionX'];
    let playerPositionY = map[location][id]['positionY'];
    let enemyPositionX = map[location]['enemy']['enemy' + enemyID]['positionX'];
    let enemyPositionY = map[location]['enemy']['enemy' + enemyID]['positionY'];
    //X check
    if (playerPositionX < enemyPositionX) {
        if ((enemyPositionX - playerPositionX) > 50) {
            return false;
        }
    } else {
        if ((playerPositionX - enemyPositionX) > 50) {
            return false;
        }
    }
    //Y check
    if (playerPositionY < enemyPositionY) {
        if ((enemyPositionY - playerPositionY) > 50) {
            return false;
        }
    } else {
        if ((playerPositionY - enemyPositionY) > 50) {
            return false;
        }
    }
    return true;
}

wss.on("connection", (ws, connectionInfo) => {
    const clientIp = connectionInfo.socket.remoteAddress;
    let validation = false;
    let clientID = 0;
    let clientLocation = '';
    //Connection Check

    //Player Connection Continuous
    ws.on("message", async data => {
        //Requisition
        const req = JSON.parse(data);

        //Return to client world positions
        if (req.message == "playersPosition" && validation) {
            //Update Player Infos
            map[req.location][req.id] = {
                'id': req.id,
                'positionX': req.positionX,
                'positionY': req.positionY,
                'direction': req.direction,
                'class': req.class,
                'ip': clientIp
            };

            //Send to Client
            ws.send(JSON.stringify(map[req.location]));
        }
        //Enemy See the Player
        if (req.message == "enemyMoving" && validation) {

            //Stop Follow
            if (!req.isSee) {
                map[req.location]['enemy']['enemy' + req.enemyID]['isMove'] = 0;
            }
            //Verify if the enemy is stopped
            if (map[req.location]['enemy']['enemy' + req.enemyID]['isMove'] == 0) {
                //If see
                if (req.isSee) {
                    //Enemy start follow
                    map[req.location]['enemy']['enemy' + req.enemyID]['isMove'] = req.id;
                }
            }
            //If is moving then
            if (map[req.location]['enemy']['enemy' + req.enemyID]['isMove'] == req.id) {
                //Pickup positions
                let positionX = map[req.location][req.id]['positionX'];
                let positionY = map[req.location][req.id]['positionY'];
                let epositionX = map[req.location]['enemy']['enemy' + req.enemyID]['positionX'];
                let epositionY = map[req.location]['enemy']['enemy' + req.enemyID]['positionY'];
                //Moving Calculation
                const positions = enemyMoving(positionX, positionY, epositionX, epositionY);
                //Add in map the new position and direction
                map[req.location]['enemy']['enemy' + req.enemyID]['positionX'] = positions[0];
                map[req.location]['enemy']['enemy' + req.enemyID]['positionY'] = positions[1];
                map[req.location]['enemy']['enemy' + req.enemyID]['direction'] = positions[2];
            }
        }
        //Enemy Collide with Player
        if (req.message == "playerCollide" && validation) {
            //Check if player is not newer the enemy
            if(!checkIfPlayerIsNewerTheEnemy(map, req.location, req.id, req.enemyID)){
                ws.close();
                return;
            }
            //Kill the enemy
            // map[req.location]['enemy']['enemy' + req.enemyID]['isDead'] = true;
            //Verify if player already in battle
            if (playersOnline[req.id]["isBattle"] == false) {
                playersOnline[req.id]["isBattle"] = true;
            }
        }
        //Login in world
        if (req.message == "login") {
            //Pickup token from database
            let token = await accounts.findOne({
                attributes: ['token'],
                where: {
                    id: req.id,
                }
            });
            //Token Check
            token = token.dataValues.token;
            if (token != req.token) {
                console.log("ID: " + req.id + " Blocked Connection: have a wrong token");
                //Close connection
                ws.close();
                return;
            } else {
                validation = true;
            }
            console.log("ID: " + req.id + " Connected to " + req.location);
            //Create the map if not created
            if (map[req.location] == undefined) {
                map[req.location] = {};
                //Add enemies into map
                map[req.location]['enemy'] = mapEvents[req.location];
            }
            //Add player in online section
            playersOnline[req.id] = {
                "id": req.id,
                "location": req.location,
                "class": req.class,
                "selectedCharacter": req.selectedCharacter,
                "isBattle": false,
            };
            //Update client info
            clientID = req.id;
            clientLocation = req.location;
            ws.send("OK");
        }
    });

    //Player Connection Closed
    ws.on("close", () => {
        let location = clientLocation;
        console.log("ID: " + clientID + " Disconnected from " + clientLocation);
        //Remove player from the world
        delete map[location][clientID];
        //Remove player from online section
        delete playersOnline[clientID];
        //Delete world if no players in
        if (Object.keys(map[location]).length == 1) {
            delete map[location];
        }

    });

});

module.exports = {
    webSocketIngameInitialize: async () => {
        setTimeout(async () => {
            console.log("Reading worlds...");
            //Pickup world informations
            const world = await worlds.findAll({
                attributes: ['id_world', 'name', 'event', 'npc', 'enemy'],
            });
            let i = 0;
            //Save in map Events
            while (true) {
                try {
                    let id = '';
                    //Find map id
                    switch (world[i].dataValues.id_world.toString().length) {
                        case 1: id = '00' + world[i].dataValues.id_world; break;
                        case 2: id = '0' + world[i].dataValues.id_world; break;
                        case 3: id = world[i].dataValues.id_world.toString(); break;
                    }
                    //Add events to mapEvents
                    mapEvents[world[i].dataValues.name + id] = JSON.parse(world[i].dataValues.enemy)
                    i++;
                } catch (_) {
                    break;
                }
            }
            console.log("Successfully reading the worlds");
            console.log("Server Ingame started in ports 8081: ws://localhost:8081");
            return wss;
        }, 200);
    },
    map: map,
    playersOnline: playersOnline,
}