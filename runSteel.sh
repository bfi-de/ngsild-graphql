#!/bin/bash
MODEL_FOLDER="./modelSteel" FILTERED_FOLDER_NAMES=Transformations FILTERED_FILE_NAMES="ChemicalComposition,SecondaryMetallurgy,Transformation,sample" GRAPHQL_VIZ_GROUPS="[[\"ContinuousCastingMachine\", \"HotRollingMill\"]]" GRAPHQL_VIZ_QUERY="{__n  ProductionEquipments {__n    id__n    type__n    isPartOf {__n      id__n      type__n    }__n  }__n}" docker-compose up -d
