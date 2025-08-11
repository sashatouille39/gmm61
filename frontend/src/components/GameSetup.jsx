import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Separator } from './ui/separator';
import { 
  Users, 
  Zap, 
  ArrowLeft, 
  Play, 
  Shuffle, 
  UserPlus,
  Settings2,
  Target,
  DollarSign,
  Crown,
  Star
} from 'lucide-react';
import { generateRandomPlayer, EVENT_CATEGORIES } from '../mock/mockData';
import { celebritiesService } from '../services/celebritiesService';
import CustomPlayersList from './CustomPlayersList';
import GroupManager from './GroupManager';

const GameSetup = ({ gameState, onStartGame }) => {
  const navigate = useNavigate();
  const [players, setPlayers] = useState([]);
  const [playerCount, setPlayerCount] = useState(100);
  const [selectedEvents, setSelectedEvents] = useState([]);
  const [gameMode, setGameMode] = useState('standard');
  const [isGenerating, setIsGenerating] = useState(false);
  const [availableEvents, setAvailableEvents] = useState([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [preserveEventOrder, setPreserveEventOrder] = useState(true); // Nouvel état pour préserver l'ordre
  const [currentGameId, setCurrentGameId] = useState(null); // Pour gérer les groupes
  const [showGroupManager, setShowGroupManager] = useState(false);
  const [pastWinners, setPastWinners] = useState([]);
  const [ownedCelebrities, setOwnedCelebrities] = useState([]);

  const gameModes = {
    standard: { name: 'Standard', cost: 100000, description: 'Jeu classique avec épreuves variées' }
  };

  // Charger les anciens gagnants depuis l'API backend
  const loadPastWinners = async () => {
    try {
      const backendUrl = process.env.REACT_APP_BACKEND_URL;
      const response = await fetch(`${backendUrl}/api/statistics/winners`);
      if (response.ok) {
        const winners = await response.json();
        setPastWinners(winners);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des gagnants:', error);
    }
  };

  // Charger les célébrités possédées
  const loadOwnedCelebrities = async () => {
    try {
      if (gameState.ownedCelebrities && gameState.ownedCelebrities.length > 0) {
        const celebrities = await celebritiesService.getOwnedCelebrities(gameState.ownedCelebrities);
        setOwnedCelebrities(celebrities);
      } else {
        setOwnedCelebrities([]);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des célébrités possédées:', error);
      setOwnedCelebrities([]);
    }
  };

  // Charger les épreuves depuis l'API backend
  const loadEventsFromAPI = async () => {
    setIsLoadingEvents(true);
    try {
      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
      const response = await fetch(`${backendUrl}/api/games/events/available`);
      
      if (!response.ok) {
        throw new Error('Erreur lors du chargement des épreuves');
      }
      
      const events = await response.json();
      // Transformer les données de l'API pour correspondre au format attendu du frontend
      const transformedEvents = events.map(event => ({
        id: event.id,
        name: event.name,
        type: event.type,
        difficulty: event.difficulty,
        category: event.type, // Utiliser le type comme catégorie
        duration: event.survival_time_max || 300,
        description: event.description,
        killRequired: event.elimination_rate > 0.7, // Considérer comme "kill required" si très mortel
        elimination_rate: event.elimination_rate, // Conserver le taux de mortalité corrigé
        decor: event.decor,
        death_animations: event.death_animations,
        special_mechanics: event.special_mechanics
      }));
      
      setAvailableEvents(transformedEvents);
      console.log(`Épreuves chargées depuis l'API: ${transformedEvents.length} épreuves avec taux corrigés`);
    } catch (error) {
      console.error('Erreur lors du chargement des épreuves:', error);
      // Pas de fallback vers mockData, on veut utiliser les données du backend
      setAvailableEvents([]);
    }
    setIsLoadingEvents(false);
  };

  const generatePlayers = async () => {
    setIsGenerating(true);
    
    try {
      // Appel de l'API backend pour générer les joueurs avec des noms authentiques
      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
      const response = await fetch(`${backendUrl}/api/games/generate-players?count=${playerCount}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la génération des joueurs');
      }

      const newPlayers = await response.json();
      
      // Simulation du temps de génération pour l'effet visuel
      for (let i = 0; i < newPlayers.length; i += 20) {
        const batch = newPlayers.slice(0, i + 20);
        setPlayers([...batch]);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      setPlayers(newPlayers);
    } catch (error) {
      console.error('Erreur lors de la génération des joueurs:', error);
      // Fallback vers la génération frontend en cas d'erreur
      const newPlayers = [];
      for (let i = 1; i <= playerCount; i++) {
        newPlayers.push(generateRandomPlayer(i));
      }
      setPlayers(newPlayers);
    }
    
    setIsGenerating(false);
  };

  const selectRandomEvents = () => {
    const shuffled = [...availableEvents].sort(() => 0.5 - Math.random());
    const eventCount = Math.min(8, shuffled.length);
    setSelectedEvents(shuffled.slice(0, eventCount).map(event => event.id));
  };

  const toggleEvent = (eventId) => {
    setSelectedEvents(prev => 
      prev.includes(eventId) 
        ? prev.filter(id => id !== eventId)
        : [...prev, eventId]
    );
  };

  const calculateTotalCost = () => {
    const baseCost = gameModes[gameMode].cost;
    const playerCost = Math.floor(playerCount * 100); // 100$ par joueur comme demandé
    const eventCost = selectedEvents.length * 5000; // 5,000$ par épreuve comme demandé
    return baseCost + playerCost + eventCost;
  };

  const canAfford = () => {
    return gameState.money >= calculateTotalCost();
  };

  const startGame = async () => {
    console.log('startGame appelé');
    console.log('canAfford():', canAfford());
    console.log('players.length:', players.length);
    console.log('selectedEvents.length:', selectedEvents.length);
    console.log('players:', players);
    console.log('selectedEvents:', selectedEvents);
    
    if (!canAfford()) {
      console.log('Budget insuffisant');
      return;
    }
    if (players.length === 0) {
      console.log('Aucun joueur');
      return;
    }
    if (selectedEvents.length === 0) {
      console.log('Aucune épreuve sélectionnée');
      return;
    }
    
    const eventsData = availableEvents.filter(event => selectedEvents.includes(event.id));
    // Réorganiser les événements selon l'ordre sélectionné
    const orderedEvents = selectedEvents.map(eventId => 
      availableEvents.find(event => event.id === eventId)
    ).filter(Boolean);
    
    try {
      // Appeler l'API pour créer la partie
      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
      const response = await fetch(`${backendUrl}/api/games/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          player_count: players.length,
          game_mode: gameMode,
          selected_events: selectedEvents,
          all_players: players.map(p => ({
            name: p.name,
            nationality: p.nationality,
            gender: p.gender,
            role: p.role,
            stats: p.stats,
            portrait: p.portrait,
            uniform: p.uniform,
            isCustom: p.isCustom || false
          })),
          preserve_event_order: preserveEventOrder
        }),
      });

      if (response.ok) {
        const gameData = await response.json();
        setCurrentGameId(gameData.id);
        
        // Essayer d'appliquer les groupes pré-configurés si ils existent
        try {
          const groupsResponse = await fetch(`${backendUrl}/api/games/${gameData.id}/groups/apply-preconfigured`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          });
          
          if (groupsResponse.ok) {
            const groupsData = await groupsResponse.json();
            console.log('Groupes pré-configurés appliqués:', groupsData.applied_groups);
          } else {
            console.log('Aucun groupe pré-configuré à appliquer ou erreur lors de l\'application');
          }
        } catch (groupError) {
          console.log('Erreur lors de l\'application des groupes pré-configurés:', groupError);
        }
        
        onStartGame(players, orderedEvents, { 
          preserveEventOrder, 
          gameMode,
          selectedEventIds: selectedEvents,
          gameId: gameData.id 
        });
        navigate('/game-arena');
      } else {
        console.error('Erreur lors de la création de la partie');
      }
    } catch (error) {
      console.error('Erreur de connexion:', error);
    }
  };

  useEffect(() => {
    loadEventsFromAPI();
    loadPastWinners();
    loadOwnedCelebrities();
  }, []);

  // Recharger les célébrités quand la liste des célébrités possédées change
  useEffect(() => {
    loadOwnedCelebrities();
  }, [gameState.ownedCelebrities]);

  // Supprimer la sélection automatique d'épreuves
  // L'utilisateur doit choisir explicitement "mon ordre" ou "choisir aléatoirement"

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-red-900 to-black p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              onClick={() => navigate('/')}
              className="text-gray-400 hover:text-white"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Retour
            </Button>
            <div>
              <h1 className="text-4xl font-black text-white">Configuration de partie</h1>
              <p className="text-gray-400">Préparez votre propre Squid Game</p>
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-2xl font-bold text-green-400">${gameState.money.toLocaleString()}</div>
            <div className="text-sm text-gray-400">Budget disponible</div>
          </div>
        </div>

        <Tabs defaultValue="players" className="space-y-6">
          <TabsList className="bg-black/50 border border-red-500/30">
            <TabsTrigger value="players" className="data-[state=active]:bg-red-600">
              <Users className="w-4 h-4 mr-2" />
              Joueurs
            </TabsTrigger>
            <TabsTrigger value="custom" className="data-[state=active]:bg-red-600">
              <UserPlus className="w-4 h-4 mr-2" />
              Personnalisés
            </TabsTrigger>
            <TabsTrigger value="celebrities" className="data-[state=active]:bg-red-600">
              <Crown className="w-4 h-4 mr-2" />
              Célébrités
            </TabsTrigger>
            <TabsTrigger value="events" className="data-[state=active]:bg-red-600">
              <Target className="w-4 h-4 mr-2" />
              Épreuves
            </TabsTrigger>
            <TabsTrigger value="launch" className="data-[state=active]:bg-red-600">
              <Play className="w-4 h-4 mr-2" />
              Lancement
            </TabsTrigger>
          </TabsList>

          {/* Configuration des joueurs */}
          <TabsContent value="players" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="bg-black/50 border-red-500/30 lg:col-span-1">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Settings2 className="w-5 h-5" />
                    Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <Label className="text-gray-300">Nombre de joueurs</Label>
                    <Input
                      type="number"
                      min="20"
                      max="1000"
                      value={playerCount}
                      onChange={(e) => setPlayerCount(Math.max(20, Math.min(1000, parseInt(e.target.value) || 20)))}
                      className="bg-gray-800 border-gray-600 text-white mt-2"
                    />
                    <div className="text-sm text-gray-400 mt-1">
                      Entre 20 et 1000 joueurs
                    </div>
                  </div>

                  <div>
                    <Label className="text-gray-300">Mode de jeu</Label>
                    <div className="mt-2 space-y-2">
                      {Object.entries(gameModes).map(([mode, data]) => (
                        <div
                          key={mode}
                          className={`p-3 rounded-lg cursor-pointer transition-all border ${
                            gameMode === mode
                              ? 'bg-red-600/20 border-red-500'
                              : 'bg-gray-800/50 border-gray-600 hover:bg-gray-700/50'
                          }`}
                          onClick={() => setGameMode(mode)}
                        >
                          <div className="flex justify-between items-center">
                            <span className="text-white font-medium">{data.name}</span>
                            <Badge variant="outline" className="text-green-400 border-green-400">
                              ${data.cost}
                            </Badge>
                          </div>
                          <div className="text-sm text-gray-400 mt-1">{data.description}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator className="bg-gray-600" />

                  <div className="space-y-3">
                    <Button
                      onClick={generatePlayers}
                      disabled={isGenerating}
                      className="w-full bg-red-600 hover:bg-red-700"
                    >
                      <Shuffle className="w-4 h-4 mr-2" />
                      {isGenerating ? 'Génération...' : 'Générer les joueurs'}
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => navigate('/player-creator')}
                      className="w-full border-red-500 text-red-400 hover:bg-red-500/10"
                    >
                      <UserPlus className="w-4 h-4 mr-2" />
                      Créer manuellement
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => setShowGroupManager(true)}
                      disabled={players.length < 2}
                      className="w-full border-blue-500 text-blue-400 hover:bg-blue-500/10"
                    >
                      <Users className="w-4 h-4 mr-2" />
                      Gérer les Groupes
                    </Button>
                    
                    {players.length < 2 && (
                      <p className="text-xs text-gray-500 text-center">
                        Minimum 2 joueurs requis pour créer des groupes
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-black/50 border-red-500/30 lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-white flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      Joueurs générés ({players.length})
                    </span>
                    {isGenerating && (
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                        Génération en cours...
                      </div>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {players.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                      <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <p>Aucun joueur généré</p>
                      <p className="text-sm">Cliquez sur "Générer les joueurs" pour commencer</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 max-h-96 overflow-y-auto">
                      {players.map((player) => (
                        <div
                          key={player.id}
                          className={`border rounded-lg p-3 text-center hover:bg-gray-700/50 transition-colors ${
                            player.isCustom 
                              ? 'bg-blue-800/30 border-blue-500' 
                              : player.isCelebrity
                                ? 'bg-yellow-800/30 border-yellow-500'
                                : 'bg-gray-800/50 border-gray-600'
                          }`}
                        >
                          <div className={`w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center text-white font-bold ${
                            player.isCustom 
                              ? 'bg-blue-600' 
                              : player.isCelebrity
                                ? 'bg-yellow-600'
                                : 'bg-red-600'
                          }`}>
                            {player.isCustom ? '👤' : player.isCelebrity ? '👑' : player.number}
                          </div>
                          <div className="text-white text-sm font-medium truncate flex items-center justify-center gap-1">
                            {player.name}
                            {player.isCustom && <span className="text-blue-400">✨</span>}
                            {player.isCelebrity && <span className="text-yellow-400">👑</span>}
                          </div>
                          <div className="text-xs text-gray-400">{player.nationality}</div>
                          <Badge
                            variant="outline"
                            className={`text-xs mt-1 ${
                              player.isCustom 
                                ? 'border-blue-400 text-blue-400'
                                : player.isCelebrity
                                  ? 'border-yellow-400 text-yellow-400'
                                  : 'border-red-400 text-red-400'
                            }`}
                          >
                            {player.isCustom ? 'Personnalisé' : player.isCelebrity ? 'Célébrité' : player.role}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Gestion des groupes */}
          {showGroupManager && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-gray-800">Gestion des Groupes</h2>
                  <Button
                    variant="ghost"
                    onClick={() => setShowGroupManager(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </Button>
                </div>
                <GroupManager 
                  players={players}
                  onGroupsCreated={(groups) => {
                    console.log('Groups created:', groups);
                    setShowGroupManager(false);
                  }}
                  onGroupsUpdated={(groups) => {
                    console.log('Groups updated:', groups);
                  }}
                />
              </div>
            </div>
          )}

          {/* Joueurs personnalisés */}
          <TabsContent value="custom" className="space-y-6">
            <CustomPlayersList 
              onSelectPlayer={(player) => {
                // Ajouter le joueur à la liste des joueurs sélectionnés avec les propriétés requises
                const formattedPlayer = {
                  ...player,
                  id: Date.now() + Math.random(), // Nouvel ID pour éviter les doublons
                  number: String(players.length + 1).padStart(3, '0'),
                  alive: true, // CRITICAL: S'assurer que le joueur est vivant au début
                  kills: 0,
                  betrayals: 0,
                  survivedEvents: 0,
                  totalScore: 0,
                  isCustom: true, // Marquer comme joueur personnalisé
                  uniform: player.uniform || {
                    style: 'Standard',
                    color: '#00FF00', // Vert par défaut pour les distinguer
                    pattern: 'Uni'
                  }
                };
                
                setPlayers(prev => {
                  const newPlayers = [...prev, formattedPlayer];
                  
                  // Feedback visuel - notification temporaire
                  const notification = document.createElement('div');
                  notification.innerHTML = `
                    <div class="fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 flex items-center gap-2">
                      <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
                      </svg>
                      <span>Joueur "${player.name}" ajouté à la partie !</span>
                    </div>
                  `;
                  document.body.appendChild(notification.firstElementChild);
                  
                  // Supprimer la notification après 3 secondes
                  setTimeout(() => {
                    const notif = document.querySelector('.fixed.top-4.right-4');
                    if (notif) notif.remove();
                  }, 3000);
                  
                  return newPlayers;
                });
              }}
              onCreateNew={() => navigate('/player-creator')}
              selectedPlayers={players.filter(p => p.isCustom)}
            />
          </TabsContent>

          {/* Célébrités possédées */}
          <TabsContent value="celebrities" className="space-y-6">
            <Card className="bg-black/50 border-red-500/30">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Crown className="w-5 h-5" />
                  Célébrités possédées
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(!gameState.ownedCelebrities || gameState.ownedCelebrities.length === 0) ? (
                  <div className="text-center py-12 text-gray-400">
                    <Crown className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>Aucune célébrité possédée</p>
                    <p className="text-sm mb-4">Visitez le Salon VIP pour acheter des célébrités</p>
                    <Button
                      onClick={() => navigate('/vip-salon')}
                      className="bg-yellow-600 hover:bg-yellow-700"
                    >
                      <Crown className="w-4 h-4 mr-2" />
                      Aller au Salon VIP
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Afficher les célébrités normales possédées */}
                    {ownedCelebrities
                      .map((celebrity) => {
                        const isSelected = players.some(p => p.celebrityId === celebrity.id);
                        
                        return (
                          <div
                            key={celebrity.id}
                            className={`p-4 rounded-lg border transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-green-900/20 border-green-500'
                                : 'bg-gray-800/50 border-gray-600 hover:bg-gray-700/50'
                            }`}
                            onClick={() => {
                              if (!isSelected) {
                                console.log('Célébrité sélectionnée:', celebrity);
                                console.log('Stats de la célébrité:', celebrity.stats);
                                
                                // Convertir la célébrité en joueur avec format correct pour l'API
                                const celebrityAsPlayer = {
                                  id: Date.now() + Math.random(),
                                  number: String(players.length + 1).padStart(3, '0'),
                                  name: celebrity.name,
                                  nationality: celebrity.nationality,
                                  gender: Math.random() > 0.5 ? 'M' : 'F',
                                  age: 25 + Math.floor(Math.random() * 20),
                                  // Utiliser un rôle valide selon la catégorie de la célébrité
                                  role: celebrity.category === 'Sportifs' ? 'sportif' : 
                                        celebrity.category === 'Scientifiques' ? 'intelligent' : 'normal',
                                  stats: celebrity.stats,
                                  // Utiliser les noms de champs corrects pour l'API backend
                                  portrait: {
                                    face_shape: 'Ovale',
                                    skin_color: '#F4B980',
                                    hairstyle: 'Cheveux courts',
                                    hair_color: '#2C1B18',
                                    eye_color: '#654321',
                                    eye_shape: 'Amande'
                                  },
                                  uniform: {
                                    style: 'Classic',
                                    color: 'Rouge',
                                    pattern: 'Uni'
                                  },
                                  alive: true,
                                  kills: 0,
                                  betrayals: 0,
                                  survivedEvents: 0,
                                  totalScore: 0,
                                  celebrityId: celebrity.id,
                                  isCelebrity: true,
                                  isCustom: true, // Marquer comme custom pour être inclus dans all_players
                                  category: celebrity.category,
                                  stars: celebrity.stars,
                                  wins: celebrity.wins || 0,
                                  biography: celebrity.biography
                                };
                                
                                console.log('Joueur créé depuis célébrité:', celebrityAsPlayer);
                                setPlayers(prev => {
                                  const newPlayers = [...prev, celebrityAsPlayer];
                                  console.log('Nouveaux joueurs:', newPlayers);
                                  return newPlayers;
                                });
                              }
                            }}
                          >
                            <div className="flex items-center gap-3 mb-3">
                              <div className="w-12 h-12 bg-gradient-to-br from-yellow-600 to-yellow-800 rounded-full flex items-center justify-center">
                                <Crown className="w-6 h-6 text-white" />
                              </div>
                              <div className="flex-1">
                                <h3 className="text-white font-medium">{celebrity.name}</h3>
                                <div className="flex items-center gap-1 mt-1">
                                  {[...Array(5)].map((_, i) => (
                                    <Star 
                                      key={i}
                                      className={`w-3 h-3 ${
                                        i < celebrity.stars ? 'text-yellow-400 fill-current' : 'text-gray-600'
                                      }`}
                                    />
                                  ))}
                                </div>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-400">Catégorie:</span>
                                <span className="text-white">{celebrity.category}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-400">Nationalité:</span>
                                <span className="text-white">{celebrity.nationality}</span>
                              </div>
                              {celebrity.wins && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-400">Victoires:</span>
                                  <span className="text-yellow-400">{celebrity.wins}</span>
                                </div>
                              )}
                            </div>

                            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                              <div className="text-center">
                                <div className="text-blue-400">{celebrity.stats.intelligence}</div>
                                <div className="text-gray-400">Int</div>
                              </div>
                              <div className="text-center">
                                <div className="text-red-400">{celebrity.stats.force}</div>
                                <div className="text-gray-400">For</div>
                              </div>
                              <div className="text-center">
                                <div className="text-green-400">{celebrity.stats.agilité}</div>
                                <div className="text-gray-400">Agi</div>
                              </div>
                            </div>

                            {isSelected && (
                              <div className="mt-3 text-center">
                                <Badge className="bg-green-600 text-white">
                                  Sélectionné pour le jeu
                                </Badge>
                              </div>
                            )}
                          </div>
                        );
                      })}

                    {/* Afficher les anciens gagnants possédés */}
                    {pastWinners
                      .filter(winner => gameState.ownedCelebrities.includes(winner.id))
                      .map((winner) => {
                        const isSelected = players.some(p => p.celebrityId === winner.id);
                        
                        return (
                          <div
                            key={winner.id}
                            className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-green-900/20 border-green-500'
                                : 'bg-gradient-to-br from-yellow-900/30 to-red-900/30 border-yellow-400/50 hover:border-yellow-400/70'
                            }`}
                            onClick={() => {
                              if (!isSelected) {
                                // Convertir l'ancien gagnant en joueur
                                const winnerAsPlayer = {
                                  id: Date.now() + Math.random(),
                                  number: String(players.length + 1).padStart(3, '0'),
                                  name: winner.name,
                                  nationality: winner.nationality,
                                  gender: Math.random() > 0.5 ? 'M' : 'F',
                                  age: 25 + Math.floor(Math.random() * 20),
                                  // Utiliser un rôle valide selon la catégorie de l'ancien gagnant
                                  role: winner.category === 'Sportifs' ? 'sportif' : 
                                        winner.category === 'Scientifiques' ? 'intelligent' : 'normal',
                                  stats: winner.stats,
                                  // Utiliser les noms de champs corrects pour l'API backend (snake_case)
                                  portrait: {
                                    face_shape: 'Ovale',
                                    skin_color: '#F4B980',
                                    hairstyle: 'Cheveux courts',
                                    hair_color: '#2C1B18',
                                    eye_color: '#654321',
                                    eye_shape: 'Amande'
                                  },
                                  uniform: {
                                    style: 'Classic',
                                    color: 'Rouge',
                                    pattern: 'Uni'
                                  },
                                  alive: true,
                                  kills: 0,
                                  betrayals: 0,
                                  survivedEvents: 0,
                                  totalScore: 0,
                                  celebrityId: winner.id,
                                  isCelebrity: true,
                                  isCustom: true, // Marquer comme custom pour être inclus dans all_players
                                  category: winner.category,
                                  stars: winner.stars,
                                  wins: winner.wins || 1,
                                  biography: winner.biography
                                };
                                
                                setPlayers(prev => [...prev, winnerAsPlayer]);
                              }
                            }}
                          >
                            <div className="flex items-center gap-3 mb-3">
                              <div className="w-12 h-12 bg-gradient-to-br from-yellow-600 to-red-600 rounded-full flex items-center justify-center">
                                <Crown className="w-6 h-6 text-yellow-200" />
                              </div>
                              <div className="flex-1">
                                <h3 className="text-white font-medium">{winner.name}</h3>
                                <div className="flex items-center gap-1 mt-1">
                                  {[...Array(5)].map((_, i) => (
                                    <Star 
                                      key={i}
                                      className={`w-3 h-3 ${
                                        i < winner.stars ? 'text-yellow-400 fill-current' : 'text-gray-600'
                                      }`}
                                    />
                                  ))}
                                </div>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-400">Catégorie:</span>
                                <span className="text-yellow-400 font-medium">{winner.category}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-400">Nationalité:</span>
                                <span className="text-white">{winner.nationality}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-400">Victoires:</span>
                                <span className="text-yellow-400">Au moins {winner.wins}</span>
                              </div>
                            </div>

                            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                              <div className="text-center">
                                <div className="text-blue-400 font-bold">{winner.stats.intelligence}</div>
                                <div className="text-gray-400">Int</div>
                              </div>
                              <div className="text-center">
                                <div className="text-red-400 font-bold">{winner.stats.force}</div>
                                <div className="text-gray-400">For</div>
                              </div>
                              <div className="text-center">
                                <div className="text-green-400 font-bold">{winner.stats.agilité}</div>
                                <div className="text-gray-400">Agi</div>
                              </div>
                            </div>

                            {isSelected && (
                              <div className="mt-3 text-center">
                                <Badge className="bg-green-600 text-white">
                                  Sélectionné pour le jeu
                                </Badge>
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Configuration des épreuves */}
          <TabsContent value="events" className="space-y-6">
            <Card className="bg-black/50 border-red-500/30">
              <CardHeader>
                <CardTitle className="text-white flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Target className="w-5 h-5" />
                    Sélection des épreuves
                  </span>
                  <Button
                    variant="outline"
                    onClick={selectRandomEvents}
                    className="border-red-500 text-red-400 hover:bg-red-500/10"
                  >
                    <Shuffle className="w-4 h-4 mr-2" />
                    Sélection aléatoire
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Option de préservation d'ordre */}
                <div className="mb-6 p-4 bg-gray-800/30 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-white font-medium text-sm">Ordre des épreuves</h3>
                      <p className="text-gray-400 text-xs mt-1">
                        {preserveEventOrder 
                          ? "Les épreuves se dérouleront dans l'ordre que vous les sélectionnez"
                          : "Les épreuves finales seront automatiquement placées à la fin"
                        }
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPreserveEventOrder(true)}
                        className={`px-3 py-1 text-xs rounded transition-all ${
                          preserveEventOrder
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                        }`}
                      >
                        Mon ordre
                      </button>
                      <button
                        onClick={() => setPreserveEventOrder(false)}
                        className={`px-3 py-1 text-xs rounded transition-all ${
                          !preserveEventOrder
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                        }`}
                      >
                        Finales à la fin
                      </button>
                    </div>
                  </div>
                </div>
                
                {isLoadingEvents ? (
                  <div className="text-center py-12 text-gray-400">
                    <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p>Chargement des épreuves...</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Organiser les événements par catégorie */}
                    {Object.entries(
                      availableEvents.reduce((acc, event) => {
                        const category = event.category || 'autre';
                        if (!acc[category]) acc[category] = [];
                        acc[category].push(event);
                        return acc;
                      }, {})
                    ).map(([category, events]) => (
                      <div key={category} className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-white font-semibold text-lg capitalize flex items-center gap-2">
                            {category === 'finale' && '👑'}
                            {category === 'classiques' && '🎯'}
                            {category === 'combat' && '⚔️'}
                            {category === 'athletique' && '🏃'}
                            {category === 'technologique' && '🤖'}
                            {category === 'psychologique' && '🧠'}
                            {category === 'survie' && '🏔️'}
                            {category === 'extreme' && '💀'}
                            {category}
                            {category === 'finale' && (
                              <Badge variant="destructive" className="text-xs">
                                Se joue toujours en dernier
                              </Badge>
                            )}
                          </h3>
                          <Badge variant="outline" className="text-gray-400">
                            {events.length} épreuve{events.length > 1 ? 's' : ''}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {events.map((event) => (
                            <div
                              key={event.id}
                              className={`p-4 rounded-lg cursor-pointer transition-all border ${
                                selectedEvents.includes(event.id)
                                  ? 'bg-red-600/20 border-red-500'
                                  : category === 'finale'
                                  ? 'bg-yellow-600/10 border-yellow-500/30 hover:bg-yellow-600/20'
                                  : 'bg-gray-800/50 border-gray-600 hover:bg-gray-700/50'
                              }`}
                              onClick={() => toggleEvent(event.id)}
                            >
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
                                  <h4 className="text-white font-medium text-sm">{event.name}</h4>
                                  {/* Indicateur d'ordre */}
                                  {selectedEvents.includes(event.id) && (
                                    <Badge 
                                      variant="outline" 
                                      className="text-blue-400 border-blue-400 text-xs"
                                    >
                                      #{selectedEvents.indexOf(event.id) + 1}
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex flex-col gap-1">
                                  <Badge
                                    variant={event.type === 'force' ? 'destructive' : event.type === 'agilité' ? 'default' : 'secondary'}
                                    className="text-xs"
                                  >
                                    {event.type}
                                  </Badge>
                                  {event.is_final && (
                                    <Badge variant="destructive" className="text-xs">
                                      FINALE
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <p className="text-gray-400 text-xs">{event.description}</p>
                              
                              {/* Afficher le taux de mortalité corrigé */}
                              <div className="flex justify-between items-center mt-2">
                                <div className="flex text-yellow-400">
                                  {[...Array(5)].map((_, i) => (
                                    <span key={i} className={i < event.difficulty ? '★' : '☆'}></span>
                                  ))}
                                </div>
                                <div className="text-xs">
                                  <span className="text-green-400">+$500</span>
                                  {event.elimination_rate && (
                                    <span className={`ml-2 ${event.is_final ? 'text-red-500 font-bold' : 'text-red-400'}`}>
                                      {Math.round(event.elimination_rate * 100)}% mortalité
                                      {event.is_final && ' → 1 gagnant'}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Lancement */}
          <TabsContent value="launch" className="space-y-6">
            <Card className="bg-black/50 border-red-500/30">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Play className="w-5 h-5" />
                  Récapitulatif et lancement
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Résumé des joueurs */}
                  <div className="bg-gray-800/30 rounded-lg p-4">
                    <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Joueurs
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Total:</span>
                        <span className="text-white">{players.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Coût par joueur:</span>
                        <span className="text-green-400">$100</span>
                      </div>
                      <Separator className="bg-gray-600" />
                      <div className="flex justify-between font-medium">
                        <span className="text-gray-300">Sous-total:</span>
                        <span className="text-green-400">${(players.length * 100).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Résumé des épreuves */}
                  <div className="bg-gray-800/30 rounded-lg p-4">
                    <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                      <Target className="w-4 h-4" />
                      Épreuves
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Sélectionnées:</span>
                        <span className="text-white">{selectedEvents.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Coût par épreuve:</span>
                        <span className="text-green-400">$5,000</span>
                      </div>
                      <Separator className="bg-gray-600" />
                      <div className="flex justify-between font-medium">
                        <span className="text-gray-300">Sous-total:</span>
                        <span className="text-green-400">${(selectedEvents.length * 5000).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Coût total */}
                  <div className="bg-gray-800/30 rounded-lg p-4">
                    <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      Coût total
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Mode {gameModes[gameMode].name}:</span>
                        <span className="text-green-400">${gameModes[gameMode].cost}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Joueurs:</span>
                        <span className="text-green-400">${(players.length * 100).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Épreuves:</span>
                        <span className="text-green-400">${(selectedEvents.length * 5000).toLocaleString()}</span>
                      </div>
                      <Separator className="bg-gray-600" />
                      <div className="flex justify-between text-lg font-bold">
                        <span className="text-white">Total:</span>
                        <span className={canAfford() ? "text-green-400" : "text-red-400"}>
                          ${calculateTotalCost().toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bouton de lancement */}
                <div className="text-center">
                  <Button
                    onClick={startGame}
                    disabled={!canAfford() || players.length === 0 || selectedEvents.length === 0}
                    className={`px-12 py-6 text-lg font-bold ${
                      canAfford() && players.length > 0 && selectedEvents.length > 0
                        ? 'bg-red-600 hover:bg-red-700'
                        : 'bg-gray-600 cursor-not-allowed'
                    }`}
                  >
                    <Play className="w-6 h-6 mr-3" />
                    {!canAfford() ? 'Budget insuffisant' : 
                     players.length === 0 ? 'Aucun joueur' :
                     selectedEvents.length === 0 ? 'Aucune épreuve' :
                     'LANCER LA PARTIE'}
                  </Button>
                  
                  {(!canAfford() || players.length === 0 || selectedEvents.length === 0) && (
                    <p className="text-red-400 text-sm mt-3">
                      {!canAfford() && `Il vous manque $${(calculateTotalCost() - gameState.money).toLocaleString()}`}
                      {players.length === 0 && 'Générez d\'abord des joueurs'}
                      {selectedEvents.length === 0 && 'Sélectionnez au moins une épreuve'}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default GameSetup;