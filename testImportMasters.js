const fs = require("fs");

const {
    importMasters
} = require("./src/tally/importMasters");

(async () => {

    const masters = await importMasters({

        company: "Sunil Ent(Client)"

    });

    

})();