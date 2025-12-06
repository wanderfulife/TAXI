// 🚕 TAXI/VTC SURVEY - TRAVÉES
// Survey for tracking taxi and VTC movements across station bays

export const templateSurveyQuestions = [
    // Q1 - Heure d'arrivée
    {
        id: "Q1",
        text: "Heure d'arrivée (heure/minute/seconde) :",
        type: 'freeText',
        freeTextPlaceholder: "HH:MM:SS",
        next: "Q2"
    },

    // Q2 - Travée empruntée
    {
        id: "Q2",
        text: "Travée empruntée :",
        type: 'singleChoice',
        options: [
            { id: 1, text: "Travée 1", next: "Q3" },
            { id: 2, text: "Travée 2", next: "Q3" },
            { id: 3, text: "Travée 3", next: "Q3" }
        ]
    },

    // Q3 - Type de véhicule
    {
        id: "Q3",
        text: "Type de véhicule :",
        type: 'singleChoice',
        options: [
            { id: 1, text: "TAXI", next: "Q4" },
            { id: 2, text: "VTC", next: "Q4" }
        ]
    },

    // Q4 - Type de pose
    {
        id: "Q4",
        text: "Type de pose :",
        type: 'singleChoice',
        options: [
            { id: 1, text: "Pose", next: "Q5" },
            { id: 2, text: "Dépose", next: "Q5" },
            { id: 3, text: "Pose + dépose", next: "Q5" },
            { id: 4, text: "Arrivée et départ à vide", next: "Q5" }
        ]
    },

    // Q5 - Heure de départ
    {
        id: "Q5",
        text: "Heure de départ (heure/minute/seconde) :",
        type: 'freeText',
        freeTextPlaceholder: "HH:MM:SS",
        next: "end"
    }
];

/*
🎯 TAXI/VTC SURVEY STRUCTURE:

⚡ FLOW:
Q1 (Heure arrivée) → Q2 (Travée) → Q3 (Type véhicule) → Q4 (Type de pose) → Q5 (Heure départ) → end

📋 QUESTIONS:
- Q1: Heure d'arrivée (heure/minute/seconde)
- Q2: Travée empruntée (1, 2, ou 3)
- Q3: Type de véhicule (TAXI ou VTC)
- Q4: Type de pose (Pose, Dépose, Pose+dépose, Arrivée/départ à vide)
- Q5: Heure de départ (heure/minute/seconde)

✅ FEATURES:
- 5 questions fixes
- Tracking temporel (arrivée + départ)
- Identification de la travée utilisée
- Type de véhicule et opération effectuée
*/