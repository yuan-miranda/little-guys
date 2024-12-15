import {BaseOrganism} from "./BaseOrganism.js"

class PlantOrganism extends BaseOrganism {
    constructor(posX, posY) {
        super(posX, posY);
        this.proto = "PlantOrganism";
        this.type = "plant";

        this.rootNutrients = 1;
        this.airNutrients = 1;
        this.waterNutrients = 1;

        this.throttleInterval = 1000;

        this.plantLastGrown = Date.now();
        this.waterLastGrown = Date.now();
        this.rootLastGrown = Date.now();

        this.growInitialSquares();
    }

    getSeedSquare() {
        var topGreen = this.getHighestGreen();
        var seedSquare = new SeedSquare(topGreen.posX, topGreen.posY - 1);
        if (addSquare(seedSquare)) {
            var newOrg = new PlantSeedOrganism(seedSquare.posX, seedSquare.posY);
            newOrg.linkedSquare = seedSquare;
            if (addOrganism(newOrg)) {
                return seedSquare;
            } else {
                removeSquareAndChildren(seedSquare);
                console.log("Failed to add organism to seed square");
                return null;
            }
        } else {
            console.warn("Failed to generate seed square...")
            return null;
        }
    }

    growInitialSquares() {
        var ret = new Array();
        // a plant needs to grow a PlantSquare above ground 
        // and grow a RootOrganism into existing Dirt
        var topSquare = getCollidableSquareAtLocation(this.posX, this.posY - 1);
        if (topSquare != null && topSquare.proto == "WaterSquare") {
            var topTop = getCollidableSquareAtLocation(this.posX, this.posY - 2);
            if (topTop == null) {
                removeSquareAndChildren(topSquare); // fuck them kids!!!!
            } else {
                return;
            }
        }
        var newPlantSquare = addSquare(new PlantSquare(this.posX, this.posY - 1));
        if (newPlantSquare) {
            var orgSq = addOrganismSquare(new PlantLifeSquare(this.posX, this.posY - 1));
            if (orgSq) {
                orgSq.linkedSquare = newPlantSquare;
                ret.push(orgSq);
            }
        };

        // root time
        getSquares(this.posX, this.posY)
            .filter((sq) => sq.rootable)
            .forEach((sq) => {
                var rootSq = addOrganismSquare(new RootLifeSquare(this.posX, this.posY));
                if (rootSq) {
                    ret.push(rootSq);
                }
            });

        if (ret.length == 2) {
            ret.forEach((sq) => this.addAssociatedSquare(sq));
            return ret;
        } else {
            if (newPlantSquare != null) {
                removeSquareAndChildren(newPlantSquare);
            }
            ret.forEach(removeOrganismSquare);
        }
    }

    postTick() {
        var airSuckFrac = po_airSuckFrac.value;
        var waterSuckFrac = po_waterSuckFrac.value;
        var rootSuckFrac = po_rootSuckFrac.value;

        var airNutrientsGained = 0;
        var waterNutrientsGained = 0;
        var rootNutrientsGained = 0;

        this.associatedSquares.forEach((lifeSquare) => {
            rootNutrientsGained = lifeSquare.rootNutrients * rootSuckFrac;
            waterNutrientsGained = lifeSquare.waterNutrients * waterSuckFrac;

            this.rootNutrients += rootNutrientsGained;
            lifeSquare.rootNutrients -= rootNutrientsGained;

            this.waterNutrients += waterNutrientsGained;
            lifeSquare.waterNutrients -= waterNutrientsGained;

            airNutrientsGained = lifeSquare.airNutrients * airSuckFrac;

            this.airNutrients += airNutrientsGained;
            lifeSquare.airNutrients -= airNutrientsGained;
        });

        var energyGained = this.law.photosynthesis(this.airNutrients, this.waterNutrients, this.rootNutrients);

        this.currentEnergy += energyGained;
        this.totalEnergy += energyGained;

        this.airNutrients -= energyGained;
        this.waterNutrients -= energyGained;
        this.rootNutrients -= energyGained;

        // our goal is to get enough energy to hit the 'reproductionEnergy', then spurt

        var lifeCyclePercentage = (Date.now() - this.spawnTime) / this.maxLifeTime;
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

    getLowestGreen() {
        return Array.from(this.associatedSquares
            .filter((sq) => sq.type == "green")).sort((a, b) => b.posY - a.posY)[0];
    }

    getHighestGreen() {
        return Array.from(this.associatedSquares
            .filter((sq) => sq.type == "green")).sort((a, b) => a.posY - b.posY)[0];
    }

    getExteriorRoots() {
        var lowestGreen = Array.from(this.associatedSquares
            .filter((sq) => sq.type == "green")).sort((a, b) => b.posY - a.posY)[0];

        var visitedSquares = new Set();
        var exteriorRoots = new Set();
        var squaresToExplore = new Array();
        squaresToExplore.push(lowestGreen); // LifeSquare 
        visitedSquares.add(getSquares(lowestGreen.posX, lowestGreen.posY)); // TerrainSquares
        var curIdx = 0;
        do {
            var activeSquare = squaresToExplore[curIdx];
            var myNeighbors = getDirectNeighbors(activeSquare.posX, activeSquare.posY);
            for (let i = 0; i < myNeighbors.length; i++) {
                var neighbor = myNeighbors[i];
                var isExteriorRoot = true;
                if (neighbor == null) {
                    continue;
                }
                if (getCountOfOrganismsSquaresOfTypeAtPosition(neighbor.posX, neighbor.posY, "root") > 0 && (Array.from(visitedSquares).indexOf(neighbor) == -1)) {
                    squaresToExplore.push(neighbor)
                    visitedSquares.add(neighbor);
                    isExteriorRoot = false;

                }
                if (isExteriorRoot) {
                    exteriorRoots.add(activeSquare);
                }
            }
            curIdx += 1;
        } while (curIdx < squaresToExplore.length);

        return Array.from(exteriorRoots);
    }

    grow() {
        // make a decision on how to grow based on which of our needs we need the most
        let minNutrient = Math.min(Math.min(this.airNutrients, this.rootNutrients), this.waterNutrients);
        if (this.currentEnergy < 0) {
            console.log("Want to grow...but the effort is too much")
            return;
        }

        if (this.airNutrients == minNutrient) {
            this.currentEnergy -= this.growNewPlant();
            return;
        }

        if (this.rootNutrients == minNutrient) {
            this.currentEnergy -= this.growDirtRoot();
            return;
        }

        if (this.waterNutrients == minNutrient) {
            this.currentEnergy -= this.growWaterRoot();
            return;
        }
    }

    growNewPlant() {
        if (Date.now() > this.plantLastGrown + this.throttleInterval) {
            this.plantLastGrown = Date.now();
            var highestPlantSquare = Array.from(this.associatedSquares.filter((sq) => sq.type == "green").sort((a, b) => a.posY - b.posY))[0];
            if (highestPlantSquare == null) {
                // then we take highest root square;
                highestPlantSquare = Array.from(this.associatedSquares.filter((sq) => sq.type == "root").sort((a, b) => a.posY - b.posY))[0];
            }
            var newPlantSquare = new PlantSquare(highestPlantSquare.posX, highestPlantSquare.posY - 1);
            if (addSquare(newPlantSquare)) {
                var orgSq = addOrganismSquare(new PlantLifeSquare(highestPlantSquare.posX, highestPlantSquare.posY - 1));
                if (orgSq) {
                    orgSq.linkedSquare = newPlantSquare;
                    orgSq.setSpawnedEntityId(this.spawnedEntityId);
                    this.addAssociatedSquare(orgSq);
                    return 1;
                }
            };
        }
        return 0;
    }

    getNumRootNeighborsAtSquare(square) {
        return getNeighbors(square.posX, square.posY)
            .filter((sq) => sq != null)
            .filter((sq) => sq.rootable)
            .map((sq) => getCountOfOrganismsSquaresOfTypeAtPosition(sq.posX, sq.posY, "root"))
            .reduce((accumulator, currentValue) => accumulator + currentValue, 0);
    }

    growWaterRoot() {
        if (Date.now() > this.waterLastGrown + this.throttleInterval) {
            this.waterLastGrown = Date.now();
            var wettestSquare = null;
            for (let i = 0; i < this.associatedSquares.length; i++) {
                var sq = this.associatedSquares[i];
                if (sq.type != "root") {
                    continue;
                }
                var sqNeighbors = getDirectNeighbors(sq.posX, sq.posY);
                for (let j = 0; j < sqNeighbors.length; j++) {
                    var compSquare = sqNeighbors[j];
                    if (compSquare == null
                        || !compSquare.rootable
                        || getCountOfOrganismsSquaresOfTypeAtPosition(compSquare.posX, compSquare.posY, "root") > 0) {
                        continue;
                    }
                    if (
                        // (this.getNumRootNeighborsAtSquare(compSquare) < 3) && 
                        (wettestSquare == null || (wettestSquare.waterContainment < compSquare.waterContainment))) {
                        wettestSquare = compSquare;
                    }
                }
            }
            if (wettestSquare != null) {
                var rootSquare = addOrganismSquare(new RootLifeSquare(wettestSquare.posX, wettestSquare.posY));
                if (rootSquare) {
                    this.addAssociatedSquare(rootSquare);
                    return 1;
                }
            }
        }
        return 0;
    }

    growDirtRoot() {
        if (Date.now() > this.rootLastGrown + this.throttleInterval) {
            this.rootLastGrown = Date.now();
            var dirtiestSquare = null;
            var dirtiestSquareDirtResourceAvailable = 0;

            this.associatedSquares.filter((iterSquare) => iterSquare.type == "root").forEach((iterSquare) => {
                getDirectNeighbors(iterSquare.posX, iterSquare.posY)
                    .filter((compSquare) => compSquare != null)
                    .filter((compSquare) => compSquare.rootable)
                    .filter((compSquare) => getOrganismSquaresAtSquare(compSquare.posX, compSquare.posY).length == 0)
                    .forEach((compSquare) => {
                        var compSquareResourceAvailable = getDirectNeighbors(compSquare.posX, compSquare.posY)
                            .filter((sq) => sq != null && sq.solid && sq.nutrientValue.value > 0)
                            .map((sq) => {
                                var sqNeighbors = getDirectNeighbors(sq.posX, sq.posY);
                                var sqNeighborsRooted = Array.from(sqNeighbors.filter((ssq) => ssq != null).filter((ssq) => getCountOfOrganismsSquaresOfTypeAtPosition(ssq.posX, ssq.posY, "root")));
                                return sq.nutrientValue.value / (sqNeighborsRooted.length + 1);
                            })
                            .reduce(
                                (accumulator, currentValue) => accumulator + currentValue,
                                0,
                            );

                        if (compSquareResourceAvailable > dirtiestSquareDirtResourceAvailable ||
                            (compSquareResourceAvailable == dirtiestSquareDirtResourceAvailable && compSquare.posY < dirtiestSquare.posY)
                        ) {
                            dirtiestSquare = compSquare;
                            dirtiestSquareDirtResourceAvailable = compSquareResourceAvailable;
                        }
                    });
            });
            if (dirtiestSquare != null) {
                var rootSquare = addOrganismSquare(new RootLifeSquare(dirtiestSquare.posX, dirtiestSquare.posY));
                if (rootSquare) {
                    this.addAssociatedSquare(rootSquare);
                    return 1;
                }
            }
        }
        return 0;
    }
}

export { PlantOrganism }