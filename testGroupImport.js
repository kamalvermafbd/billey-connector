const fs = require("fs");

const {
    importGroupGuids
} = require("./src/tally/groupGuidImportService");


(async () => {

    try {

        const groupGuids =
            await importGroupGuids({

                company: "Sunil Ent(Client)"

            });


        console.log(
            "Total Group GUIDs:",
            groupGuids.length
        );


        console.log(
            "First Group:",
            groupGuids[0]
        );


       


        console.log(
            "Group GUID export completed"
        );


    } catch(err) {

        console.error(
            "GROUP GUID IMPORT ERROR"
        );

        console.error(err);

    }

})();