# Validation et Restrictions des Techniques

Ce document regroupe les règles de restriction générales des techniques selon leur rang (du Rang C au Rang S), ainsi que les détails et spécificités propres à chaque type de technique.

> **Note :** Les Rangs **SS** et **SSS** seront ajoutés ultérieurement.

---

## 1. Restrictions Générales par Rang

Les règles ci-dessous définissent les valeurs par défaut et les limites maximales autorisées pour chaque rang.

### Rang C
- **Quantité maximale** : 1 par tour
- **Sort de zone** :
  - **Préparation** : 1 tour
  - **Portée** : 10m
  - **Durée** : 3 tours
  - **Réutilisation** : Après 3 tours
- **Règle de confrontation** : Inefficace contre des cibles de résistance supérieure ou égale (voir la règle de confrontation de sorts).

### Rang B
- **Quantité maximale** : 3 max
- **Sort de zone** :
  - **Préparation** : Instantané
  - **Portée** : 20m
  - **Durée** : 3 tours
- **Dégâts** : Les dégâts infligés varient selon la résistance adverse (voir le système de vitalité).

### Rang A
- **Quantité maximale** : 5 max
- **Sort de zone** :
  - **Préparation** : Instantané
  - **Portée** : 50m
  - **Durée** : 3 tours
  - **Réutilisation** : Après 3 tours
- **Dégâts** : Les dégâts infligés varient selon la résistance adverse (voir le système de vitalité).

### Rang S
- **Quantité maximale** : 10 max
- **Sort de zone** :
  - **Préparation** : 2 tours
  - **Portée** : 100m
  - **Durée** : 3 tours
  - **Réutilisation** : Après 5 tours
- **Dégâts** : Les dégâts infligés varient selon la résistance adverse (voir le système de vitalité).

---

## 2. Types de Techniques & Effets Spécifiques

> **Adaptation du Rang pour les Types de Techniques :**
> Un type de technique n'est pas strictement verrouillé à un seul rang. Les rangs indiqués ci-dessous *(ex: Rang de référence : A ou S)* correspondent aux exemples/standards de base du document. 
> Lorsqu'une technique d'un type donné est créée ou déclinée à un autre rang (Rang C, B, A, S), ses paramètres de base (portée, durée, temps de préparation, cooldown) s'adaptent selon la grille des [Restrictions Générales par Rang](#1-restrictions-générales-par-rang).

---

### Effets de Contrôle & Altération (Mental / Physique)

#### Illusion *(Rang de référence : S)*
- **Préparation** : 2 tours
- **Couverture** : 100m (+10m à chaque amélioration)
- **Durée** : 3 tours (+1 à chaque amélioration)
- **Réutilisation** : Après 6 tours
- **Effets** :
  - Votre énergie se propage d'abord sous forme d'onde translucide pour toucher la cible.
  - Inefficace contre des cibles de mental supérieur au vôtre.
  - Inefficace contre des cibles de rang supérieur.
  - Une cible avec un mental égal au vôtre s'en rend compte immédiatement sans nécessiter d'Intelligence.
  - Une cible avec une Intelligence suffisante peut remarquer la supercherie (Intelligence supérieure de 2 points à la vôtre et même rang requis).
  - Une cible consciente a la possibilité de se libérer en sacrifiant des points d'endurance (voir le système de jeu).

#### Contrôle Mental *(Rang de référence : A)*
- **Préparation** : Instantané
- **Portée** : 50m (+10m à chaque amélioration)
- **Durée** : 3 tours (+1 à chaque amélioration)
- **Réutilisation** : Après 5 tours
- **Effets** :
  - Votre énergie se propage d'abord sous forme d'onde translucide pour toucher la cible.
  - Inefficace contre des cibles de mental supérieur au vôtre.
  - Inefficace contre des cibles de rang supérieur.
  - Une cible avec un mental égal au vôtre s'en rend compte immédiatement sans nécessiter d'Intelligence.
  - Une cible avec une Intelligence suffisante peut remarquer la supercherie (Intelligence supérieure de 2 points à la vôtre et même rang requis).
  - Une cible consciente a la possibilité de se libérer en sacrifiant des points d'endurance (voir le système de jeu).

#### Intimidation *(Rang de référence : A)*
- **Préparation** : Instantané
- **Portée** : 50m (+10m à chaque amélioration)
- **Durée** : 3 tours (+1 à chaque amélioration)
- **Réutilisation** : Après 3 tours
- **Effets** :
  - Inefficace contre des cibles de mental ou puissance supérieure ou égale au vôtre.
  - Inefficace contre des cibles de rang supérieur.
  - Contact visuel obligatoire.
  - Ciblage unique.

#### Charisme *(Rang de référence : A)*
- **Portée** : 50m (+10m à chaque amélioration)
- **Durée** : 3 tours
- **Réutilisation** : Après 3 tours
- **Effets** :
  - Inefficace contre un adversaire de rang supérieur.
  - Contact visuel obligatoire.
  - Ciblage unique.
  - Inefficace contre un adversaire ayant un mental supérieur ou égal à votre Charisme.
  - Un Charisme égal n'est pas affecté.
  - Voir le système pour les modalités de libération.

#### Entrave *(Rang variable / Tous rangs)*
- **Effets** :
  - Inefficace contre des cibles de résistance supérieure ou égale.
  - Un utilisateur de la capacité Perception a moins de chances d'être surpris.
  - **Vitesse de l'entrave** : Votre Puissance - 1.
  - **En cas d'entrave réussie** :
    - Non fatal contre des cibles de résistance supérieure ou égale.
    - Possibilité de se libérer via des sorts (efficacité selon les effets, le rang ou la puissance de la cible).
    - Une cible avec une Force supérieure à votre Puissance se libère facilement.
    - Une cible avec une Force équivalente se libère en dépensant -1 en Endurance.
    - Une cible avec une Force inférieure de -2 ou plus ne peut pas se libérer.

---

### Déplacement & Spatiotemporel

#### SpeedBlitz / Déplacement *(Rang de référence : S)*
- **Préparation** : 2 tours
- **Portée** : 20m (+10m à chaque amélioration, max 50m)
- **Réutilisation** : Après 5 tours
- **Effets** :
  - Inefficace contre des cibles de réactivité supérieure ou égale.
  - Une cible avec réactivité inférieure (-1) et intelligence supérieure (+2) peut lire vos mouvements.
  - Une cible avec réactivité inférieure (-1) et intelligence supérieure (+1) sera surprise la première fois uniquement.

#### Portail *(Rang de référence : A)*
- **Préparation** : Instantané
- **Portée** : 50m (+10m à chaque amélioration)
- **Durée** : 3 tours (+1 à chaque amélioration)
- **Réutilisation** : Après 5 tours
- **Effets** :
  - Droit à 2 portails simultanés maximum.
  - **Vitesse des portails** : Puissance - 1.
  - Adapté pour voyager ; impossible d'accéder à un endroit non visité au préalable.

#### Téléportation *(Rang de référence : A)*
- **Préparation** : Instantané
- **Portée (en combat)** : 50m (+10m à chaque amélioration)
- **Réutilisation** : Après 5 tours
- **Effets** :
  - Le déploiement sur une zone est nécessaire.
  - Adapté au voyage ; impossible d'accéder à un endroit non visité au préalable.
  - Permet de se téléporter soi-même ainsi qu'un autre objet ou personne à distance. Le contraire nécessite un contact physique.
  - Droit à une seule téléportation une fois le sort lancé.

#### Démolécularisation / Dématérialisation *(Rang de référence : S)*
- **Préparation** : 2 tours
- **Durée** : 3 tours
- **Effets / Limitations** :
  - Inefficace contre les sorts psychiques.
  - Inefficace contre les sorts de type opposé (ou de type désintégration).
  - Impossible d'attaquer en étant immatériel.

---

### Protection, Renforcement & Soin

#### Protection / Barrière *(Rang de référence : A)*
- **Préparation** : Instantané
- **Couverture maximale** : 50m (+10m à chaque amélioration)
- **Durée** : 3 tours (+1 à chaque amélioration)
- **Réutilisation** : Après 3 tours
- **Effets** :
  - Inefficace contre des techniques de puissance/force supérieure à votre Puissance.
  - Inefficace contre des sorts d'un adversaire de rang supérieur.
  - Inefficace contre des sorts de rang supérieur et de puissance équivalente.
  - Inefficace contre les sorts psychiques.
  - Les techniques de puissance et de rang équivalents s'annulent avec la barrière.

#### Boost *(Rang de référence : A)*
- **Préparation** : Instantané
- **Durée** : 3 tours
- **Effets** :
  - Boost de **+1** en Force, Vitesse et Réactivité.
  - Malus de **-1** sur les statistiques boostées à la fin de la technique.

#### Guérison / Soin *(Rang de référence : S)*
- **Préparation** : 2 tours
- **Portée** : Très faible (environ 5m)
- **Durée** : 3 tours (+1 à chaque amélioration)
- **Conditions** : Usage unique par RP.
- **Effets** :
  - Soigne 1 personne (+1 personne par amélioration).
  - Toute hémorragie est stoppée dès l'activation.
  - **+4** points de vitalité par tour.
  - **+3** en endurance (non continue).

---

### Invocation & Création

#### Création Élémentaire / Création de Créatures *(Rang de référence : A)*
- **Préparation** : Instantané
- **Durée** : 3 tours (+1 à chaque amélioration)
- **Réutilisation** : Après 5 tours
- **Effets** :
  - Les dégâts infligés varient selon la résistance adverse (voir le système de vitalité).
  - **Force et Résistance** : Égales à votre Puissance.
  - **Vitesse** : Votre Puissance - 1.
  - **Réactivité** : Égale à la vôtre.

#### Clones *(Rang de référence : S)*
- **Préparation** : 2 tours
- **Durée** : 3 tours
- **Effets** :
  - **Statistiques des clones** : Vos statistiques - 1.
  - **Nombre de clones** : 1 clone (2 max après amélioration).
  - Les statistiques diminuent en fonction du nombre de clones sur le terrain (ex. 2 clones = vos statistiques - 2).
  - Aucune capacité magique.

#### Invocation *(Rang de référence : S)*
- **Préparation** : 2 tours
- **Durée** : 3 tours (+1 à chaque amélioration)
- **Conditions** : Usage unique par RP.
- **Effets** :
  - L'invocation a droit à 2 attaques de Rang S au maximum, le reste des attaques étant de Rang A.
  - Elle ne peut lancer qu'une seule attaque par tour.
  - **Statistiques à répartir (39/50)** : Force, Vitesse, Puissance, Réactivité, Résistance.

---

### Manipulation

#### Télékinésie *(Rang de référence : A)*
- **Préparation** : Instantané
- **Portée** : 50m (+10m à chaque amélioration)
- **Durée** : 3 tours (+1 à chaque amélioration)
- **Réutilisation** : Après 5 tours
- **Effets** :
  - Une utilisation sans dégâts ne fonctionne pas sur une cible de résistance supérieure ou égale.
  - Les dégâts infligés varient selon la résistance adverse (voir le système de vitalité).