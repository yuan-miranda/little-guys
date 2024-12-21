import { removeSquare } from "../globalOperations.js";
import { removeOrganismSquare } from "../squares/_sqOperations.js";
import { removeOrganism } from "./_orgOperations.js";
import { Law } from "../Law.js";
import { randNumber } from "../common.js";
import { getCurTime } from "../globals.js";
import { getNextEntitySpawnId } from "../globals.js";

class BaseOrganism {
    constructor(square) {
        this.proto = "BaseOrganism";
        this.posX = square.posX;
        this.posY = square.posY;
        this.lifeSquares = new Array();
        this.type = "base";
        this.law = new Law();
        this.spawnedEntityId = 0;
        this.width = 0.95;
        this.xOffset = 0.5;

        this.spawnTime = getCurTime();
        this.currentEnergy = 0;
        this.totalEnergy = 0;

        // life cycle properties
        this.maxLifeTime = 1000 * 40 * 1;
        this.reproductionEnergy = 1000;
        this.reproductionEnergyUnit = 300;
        this.maximumLifeSquaresOfType = {}
        this.lifeSquaresCountByType = {};
        this.spawnedEntityId = getNextEntitySpawnId();
        this.linkSquare(square);
    }

    linkSquare(square) {
        if (square.linkedSquare != null) {
            return;
        }

        this.linkedSquare = square;
        square.linkedOrganism = this;
    }
    unlinkSquare(square) {
        this.linkedSquare = null;
        square.linkedOrganism = null;
    }

    addAssociatedLifeSquare(lifeSquare) {
        this.lifeSquares.push(lifeSquare);
        if (!(lifeSquare.type in this.lifeSquaresCountByType)) {
            this.lifeSquaresCountByType[lifeSquare.type] = 0;
        }
        this.lifeSquaresCountByType[lifeSquare.type] += 1;
    }
    removeAssociatedLifeSquare(lifeSquare) {
        this.lifeSquaresCountByType[lifeSquare.type] -= 1;
        this.lifeSquares = Array.from(this.lifeSquares.filter((lsq) => lsq != lifeSquare));
    }

    preRender() {}

    spawnSeed() {
        var seedSquare = this.getSeedSquare();
        if (seedSquare != null) {
            seedSquare.speedX = Math.floor(randNumber(-3, 3));
            seedSquare.speedY = Math.floor(randNumber(-3, -1));
            return true;
        } else {
            return false;
        }
    }

    getSeedSquare() {
        return null; // should be a SeedSquare with a contained PlantSeedOrganism or similar
    }

    getCountOfAssociatedSquaresOfProto(proto) {
        return Array.from(this.lifeSquares.filter((org) => org.proto == proto)).length;
    }
    getCountOfAssociatedSquaresOfType(type) {
        return Array.from(this.lifeSquares.filter((org) => org.type == type)).length;
    }

    growInitialSquares() { return new Array(); }

    render() {
        this.preRender();
        this.lifeSquares.forEach((sp) => sp.render())
    }

    destroy() {
        this.lifeSquares.forEach((lifeSquare) => lifeSquare.destroy());
        removeOrganism(this);
    }

    process() {
        this.preTick();
        this.tick();
        this.postTick();
    }

    preTick() {
        this.lifeSquares.forEach((sp) => sp.preTick())
    }

    tick() {
        this.lifeSquares.forEach((sp) => sp.tick())
    }

    postTick() {
        this.lifeSquares.forEach((lifeSquare) => {
            this.dirtNutrients += lifeSquare.dirtNutrients;
            this.waterNutrients += lifeSquare.waterNutrients;
            this.airNutrients += lifeSquare.airNutrients;
        });

        var energyGained = this.law.photosynthesis(this.airNutrients - this.totalEnergy, this.waterNutrients - this.totalEnergy, this.dirtNutrients - this.totalEnergy);

        this.currentEnergy += energyGained;
        this.totalEnergy += energyGained;

        var lifeCyclePercentage = (getCurTime() - this.spawnTime) / this.maxLifeTime;
        if (lifeCyclePercentage > 1) {
            this.destroy();
        }

        var currentEnergyPercentage = this.currentEnergy / this.reproductionEnergy;
        var totalEnergyLifeCycleRate = this.totalEnergy / this.maxLifeTime;

        if (currentEnergyPercentage > 1) {
            this.spawnSeed();
            this.currentEnergy -= this.reproductionEnergyUnit;
            return;
        }

        var projectedEnergyAtEOL = this.currentEnergy + (totalEnergyLifeCycleRate * (1 - lifeCyclePercentage) * this.maxLifeTime);
        if (projectedEnergyAtEOL < this.reproductionEnergy * 2) {
            this.grow();
            return;
        } else {
            return;
        }
    }

    grow() {}
}

export {BaseOrganism}