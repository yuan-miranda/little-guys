import { ALL_ORGANISMS } from "../globals.js";
import { getObjectArrFromMap } from "../common.js";
import { removeItemAll } from "../common.js";

function addNewOrganism(organism) {
    // if (getOrganismsAtSquare(organism.posX, organism.posY, true).length > 2) {
    //     organism.destroy();
    //     return false;
    // }
    if (organism.linkedSquare == null) {
        organism.destroy();
        return false;
    }
    addOrganism(organism);
    return organism;
}

function addOrganism(organism) {
    getObjectArrFromMap(ALL_ORGANISMS, organism.posX, organism.posY, true).push(organism);
    return organism;
}

function getOrganismsAtSquare(posX, posY, create=false) {
    return getObjectArrFromMap(ALL_ORGANISMS, posX, posY, create);
}

function iterateOnOrganisms(func) {
    ALL_ORGANISMS.keys().forEach((key) => ALL_ORGANISMS.get(key).keys().forEach((subkey) => ALL_ORGANISMS.get(key).get(subkey).forEach((func))));
}

function removeOrganism(organism) {
    let arr = removeItemAll(getObjectArrFromMap(ALL_ORGANISMS, organism.posX, organism.posY), organism);
    if (arr.length === 0) {
        ALL_ORGANISMS.get(organism.posX).delete(organism.posY);
    }
}

export {addNewOrganism, addOrganism, getOrganismsAtSquare, iterateOnOrganisms, removeOrganism}