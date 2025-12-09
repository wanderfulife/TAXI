// 🚕 TAXI/VTC SURVEY - TRAVÉES
// Survey for tracking taxi and VTC movements across station bays

export const templateSurveyQuestions = [
    // Q1 - Travée empruntée (arrival time is captured automatically)
    {
        id: "Q1",
        text: "Travée empruntée :",
        type: 'singleChoice',
        options: [
            { id: 1, text: "Travée 1", next: "Q2" },
            { id: 2, text: "Travée 2", next: "Q2" },
            { id: 3, text: "Travée 3", next: "Q2" }
        ]
    },

    // Q2 - Type de véhicule
    {
        id: "Q2",
        text: "Type de véhicule :",
        type: 'singleChoice',
        options: [
            { id: 1, text: "TAXI", next: "Q3" },
            { id: 2, text: "VTC", next: "Q3" }
        ]
    },

    // Q3 - Type de pose
    {
        id: "Q3",
        text: "Type de pose :",
        type: 'singleChoice',
        options: [
            { id: 1, text: "Pose", next: "Q4" },
            { id: 2, text: "Dépose", next: "Q4" },
            { id: 3, text: "Pose + dépose", next: "Q4" },
            { id: 4, text: "Arrivée et départ à vide", next: "Q4" }
        ]
    },

    // Q4 - Waiting for vehicle departure
    {
        id: "Q4",
        text: "Véhicule en attente. Cliquez sur le bouton quand le véhicule part.",
        type: 'singleChoice',
        options: [
            { id: 1, text: "Départ véhicule", next: "end" }
        ]
    }
];

/*
🎯 TAXI/VTC SURVEY STRUCTURE:

⚡ FLOW:
Q1 (Travée) → Q2 (Type véhicule) → Q3 (Type de pose) → Q4 (Attente départ) → end
NOTE: Both arrival and departure times are captured automatically:
- HEURE_DEBUT: Captured when survey starts
- HEURE_FIN: Captured when "Départ véhicule" button is clicked

📋 QUESTIONS:
- Q1: Travée empruntée (1, 2, ou 3)
- Q2: Type de véhicule (TAXI ou VTC)
- Q3: Type de pose (Pose, Dépose, Pose+dépose, Arrivée/départ à vide)
- Q4: Waiting state - Click "Départ véhicule" when vehicle leaves

✅ FEATURES:
- 3 data questions + 1 waiting state + fully automatic time tracking
- Tracking temporel (arrivée et départ automatiques)
- Identification de la travée utilisée
- Type de véhicule et opération effectuée
- Waiting state allows proper departure time recording
*/