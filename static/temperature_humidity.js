import { hexToRgb, randNumber, rgbToRgba } from "./common.js";
import { addSquare } from "./squares/_sqOperations.js";
import { MAIN_CONTEXT, CANVAS_SQUARES_X, CANVAS_SQUARES_Y, BASE_SIZE } from "./index.js";
import { WaterSquare } from "./squares/WaterSquare.js";

var temperatureMap;
var waterSaturationMap;

var curSquaresX = 0;
var curSquaresY = 0;

var clickAddTemperature = 1;
var start_temperature = 273 + 20;

var c_tempLowRGB = hexToRgb("#1dbde6");
var c_tempHighRGB = hexToRgb("#f1515e");

var c_waterSaturationLowRGB = hexToRgb("#9bafd9");
var c_waterSaturationHighRGB = hexToRgb("#103783");

var c_cloudMinRGB = hexToRgb("#f1f0f6");
var c_cloudMidRGB = hexToRgb("#dbdce1")
var c_cloudMaxRGB = hexToRgb("#818398");

var cloudMaxHumidity = 4;
var cloudRainThresh = 2;
var cloudRainMax = 8;
var cloudMaxOpacity = 0.65;

var pascalsPerWaterSquare = 10 ** 11;
// https://www.engineeringtoolbox.com/water-vapor-saturation-pressure-air-d_689.html


function saturationPressureOfWaterVapor(t) {
    return Math.E ** (77.345 + 0.057 * t - 7235 / t) / (t ** 8.2);
}

function setSquareWaterContainmentToHumidityMult(x, y, m) {
    waterSaturationMap[x][y] = saturationPressureOfWaterVapor(temperatureMap[x][y]) * m;
}

function init() {
    temperatureMap = new Map();
    waterSaturationMap = new Map();
    curSquaresX = Math.ceil(CANVAS_SQUARES_X / 4)
    curSquaresY = Math.ceil(CANVAS_SQUARES_Y / 4)

    var start_watersaturation = saturationPressureOfWaterVapor(start_temperature) * cloudMaxHumidity * cloudRainThresh;

    for (let i = 0; i < curSquaresX; i++) {
        for (let j = 0; j < curSquaresY; j++) {
            if (!(i in temperatureMap)) {
                temperatureMap[i] = new Map();
                waterSaturationMap[i] = new Map();
            }
            temperatureMap[i][j] = start_temperature;
            waterSaturationMap[i][j] = start_watersaturation;
        }
    }
}

function tickMap(
    map,
    diff_function
) {
    var xKeys = Array.from(Object.keys(map));
    for (let i = 0; i < xKeys.length; i++) {
        var yKeys = Array.from(Object.keys(map[xKeys[i]]));
        for (let j = 0; j < yKeys.length; j++) {
            var x = parseInt(xKeys[i]);
            var y = parseInt(yKeys[j]);
            var sqVal = map[x][y];
            [getMapDirectNeighbors, getMapIndirectNeighbors].forEach((f) => 
                f(x, y).forEach((loc) => {
                    var x2 = loc[0];
                    var y2 = loc[1];
                    if (x2 < 0 || x2 >= curSquaresX || y2 < 0 || y2 >= curSquaresY) {
                        return;
                    }
                    var compVal = map[x2][y2];

                    if (compVal >= sqVal) {
                        return;
                    }
                    var diff = diff_function(sqVal, compVal);
                    map[x][y] -= diff;
                    map[x2][y2] += diff;
                    sqVal = map[x][y];
                }));
        }
    }
}

function doRain() {
    var xKeys = Array.from(Object.keys(waterSaturationMap));
    for (let i = 0; i < xKeys.length; i++) {
        var yKeys = Array.from(Object.keys(waterSaturationMap[xKeys[i]]));
        for (let j = 0; j < yKeys.length; j++) {
            var x = parseInt(xKeys[i]);
            var y = parseInt(yKeys[j]);
            var adjacentHumidity = getHumidity(x, y) + getMapDirectNeighbors(x, y)
                .filter((loc) => loc[0] >= 0 && loc[0] < curSquaresX && loc[1] >= 0 && loc[1] < curSquaresY)
                .map((loc) => getHumidity(loc[0], loc[1]))
                .reduce(
                    (accumulator, currentValue) => accumulator + currentValue,
                    0,
                );

            var adjacentWaterPascals = waterSaturationMap[x][y] + getMapDirectNeighbors(x, y)
                .filter((loc) => loc[0] >= 0 && loc[0] < curSquaresX && loc[1] >= 0 && loc[1] < curSquaresY)
                .map((loc) => waterSaturationMap[loc[0]][loc[1]])
                .reduce(
                    (accumulator, currentValue) => accumulator + currentValue,
                    0,
                ) * 0.8;

            if (adjacentHumidity > (cloudMaxHumidity * 5 * cloudRainThresh) && adjacentWaterPascals > pascalsPerWaterSquare) {
                var probability = adjacentHumidity / (cloudMaxHumidity * 5 * cloudRainMax);
                var usedWaterPascalsPerSquare = pascalsPerWaterSquare / 5;

                if (Math.random() < probability && Math.random() > 0.99) {
                    var sq = addSquare(new WaterSquare(x * 4 + randNumber(0, 3), y * 4 + randNumber(0, 3)));
                    if (sq) {
                        sq.blockHealth = 0.05;
                        waterSaturationMap[x][y] -= usedWaterPascalsPerSquare;
                        getMapDirectNeighbors(x, y)
                        .filter((loc) => loc[0] >= 0 && loc[0] < curSquaresX && loc[1] >= 0 && loc[1] < curSquaresY)
                        .map((loc) =>  waterSaturationMap[loc[0]][loc[1]] -= usedWaterPascalsPerSquare);
                    }
                }
            }
        }
    }
}

function renderClouds() {
    for (let i = 0; i < curSquaresX; i++) {
        for (let j = 0; j < curSquaresY; j++) {
            var squreHumidity = getHumidity(i, j);
            if (squreHumidity < (cloudMaxHumidity * cloudRainThresh) ) {
                MAIN_CONTEXT.fillStyle = calculateColorOpacity(squreHumidity, 0, cloudMaxHumidity * cloudRainThresh, c_cloudMinRGB, c_cloudMidRGB);
            } else {
                MAIN_CONTEXT.fillStyle = calculateColor(squreHumidity, cloudMaxHumidity * cloudRainThresh, cloudMaxHumidity * cloudRainMax, c_cloudMidRGB, c_cloudMaxRGB);
            }
            MAIN_CONTEXT.fillRect(
                4 * i * BASE_SIZE,
                4 * j * BASE_SIZE,
                4 * BASE_SIZE,
                4 * BASE_SIZE
            );
        }
    }

}

function tickMaps() {
    if (temperatureMap == null || waterSaturationMap == null) {
        init();
    }
    tickMap(temperatureMap, (a, b) => (a - b) / 8);
    tickMap(waterSaturationMap, (a, b) => (a - b) / 2);
    doRain();
}

function getHumidity(x, y) {
    return waterSaturationMap[x][y] / saturationPressureOfWaterVapor(temperatureMap[x][y]);
}

function calculateColor(val, valMin, valMax, colorMin, colorMax) {
    val = Math.min(val, valMax);
    var normalized = (val - valMin) / valMax;
    return rgbToRgba(
        colorMax.r * normalized + colorMin.r * (1 - normalized),
        colorMax.g * normalized + colorMin.g * (1 - normalized),
        colorMax.b * normalized + colorMin.b * (1 - normalized),
        cloudMaxOpacity
    );
}

function calculateColorOpacity(val, valMin, valMax, colorMin, colorMax) {
    var normalized = Math.max(Math.min(1, (val - valMin) / valMax), 0);
    return rgbToRgba(
        colorMax.r * normalized + colorMin.r * (1 - normalized),
        colorMax.g * normalized + colorMin.g * (1 - normalized),
        colorMax.b * normalized + colorMin.b * (1 - normalized),
        normalized * cloudMaxOpacity
    );
}

function renderTemperature() {
    for (let i = 0; i < curSquaresX; i++) {
        for (let j = 0; j < curSquaresY; j++) {
            MAIN_CONTEXT.fillStyle = calculateColor(temperatureMap[i][j], 273, 273 + 50, c_tempLowRGB, c_tempHighRGB);
            MAIN_CONTEXT.fillRect(
                4 * i * BASE_SIZE,
                4 * j * BASE_SIZE,
                4 * BASE_SIZE,
                4 * BASE_SIZE
            );
        }
    }
}

function renderWaterSaturation() {
    for (let i = 0; i < curSquaresX; i++) {
        for (let j = 0; j < curSquaresY; j++) {
            MAIN_CONTEXT.fillStyle = calculateColor(getHumidity(i, j), cloudMaxHumidity * 0, cloudMaxHumidity * 4, c_waterSaturationLowRGB, c_waterSaturationHighRGB);
            MAIN_CONTEXT.fillRect(
                4 * i * BASE_SIZE,
                4 * j * BASE_SIZE,
                4 * BASE_SIZE,
                4 * BASE_SIZE
            );
        }
    }
}

function getMapDirectNeighbors(x, y) {
    return [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1]
    ]
} 

function getMapIndirectNeighbors(x, y) {
    return [
        [x - 1, y - 1],
        [x + 1, y - 1],
        [x + 1, y - 1],
        [x + 1, y + 1]
    ]
}

function addTemperature(x, y, dt) {
    x /= 4;
    y /= 4;
    _addTemperature(x, y, dt);
    getMapDirectNeighbors(x, y).forEach((loc) => _addTemperature(loc[0], loc[1], dt));
}

function _addTemperature(x, y, delta) {
    x = (Math.floor(x) + curSquaresX) % curSquaresX;
    y = (Math.floor(y) + curSquaresY) % curSquaresY;

    var side = delta > 0 ? 1 : -1;

    if (side > 0) {
        temperatureMap[x][y] += 1;
    } else {
        temperatureMap[x][y] = ((temperatureMap[x][y] * (delta - side)) + (side * 200)) / delta;
    }
}

function addWaterSaturation(x, y) {
    _addWaterSaturation(x, y);
    getMapDirectNeighbors(x, y).forEach((loc) => _addWaterSaturation(loc[0], loc[1]));
}

function _addWaterSaturation(x, y) {
    x = (Math.floor(x) + curSquaresX) % curSquaresX;
    y = (Math.floor(y) + curSquaresY) % curSquaresY;
    waterSaturationMap[x][y] += 0.10 * saturationPressureOfWaterVapor(temperatureMap[x][y]);
}
 
export { renderTemperature, renderWaterSaturation, tickMaps, addTemperature, addWaterSaturation, renderClouds }