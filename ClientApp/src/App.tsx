import React, {useEffect, useState} from 'react';
import type {ApiUser, AuthMode, Screen} from './types';
import {Sidebar} from './components/Sidebar';
import {TopBar} from './components/TopBar';
import {MobileNav} from './components/MobileNav';
import {TasksScreen} from './screens/TasksScreen';
import {SolveScreen} from './screens/SolveScreen';
import {AttemptsScreen} from './screens/AttemptsScreen';
import {AdminScreen} from './screens/AdminScreen';
import {AuthScreen} from './screens/AuthScreen';
import {TournamentsScreen} from './screens/TournamentsScreen';
import {HomeScreen} from './screens/HomeScreen';
import {QuizScreen} from './screens/QuizScreen';
import {getInitialNavigation, loadUser, savePersistedNav, saveUser} from './storage';
import {ThemeProvider} from './theme-context';

export default function App() {
  const [navInit] = useState(() => getInitialNavigation());
  const [currentScreen, setCurrentScreen] = useState<Screen>(navInit.screen);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(navInit.taskId);
  const [user, setUser] = useState<ApiUser | null>(null);
  const [search, setSearch] = useState('');
  const [authMode, setAuthMode] = useState<AuthMode>(navInit.authMode);

  const goAuth = (mode: AuthMode) => {
    setAuthMode(mode);
    setCurrentScreen('auth');
  };

  useEffect(() => {
    setUser(loadUser());
  }, []);

  useEffect(() => {
    saveUser(user);
  }, [user]);

  useEffect(() => {
    savePersistedNav({screen: currentScreen, taskId: selectedTaskId, authMode});
  }, [currentScreen, selectedTaskId, authMode]);

  useEffect(() => {
    if (currentScreen === 'admin' && user != null && user.role !== 'admin') {
      setCurrentScreen('home');
    }
  }, [user, currentScreen]);

  const openTask = (id: string) => {
    setSelectedTaskId(id);
    setCurrentScreen('solve');
  };

  const signOut = () => setUser(null);

  const renderScreen = () => {
    switch (currentScreen) {
      case 'home':
        return (
          <HomeScreen
            user={user}
            onGoToTasks={() => setCurrentScreen('tasks')}
            onGoToTournaments={() => setCurrentScreen('tournaments')}
            onGoToQuiz={() => setCurrentScreen('quiz')}
          />
        );
      case 'tasks':
        return <TasksScreen search={search} onOpenTask={openTask} />;
      case 'solve':
        return <SolveScreen taskId={selectedTaskId} user={user} onGoToTask={openTask} />;
      case 'attempts':
        return <AttemptsScreen search={search} onOpenTask={openTask} user={user} />;
      case 'admin':
        return <AdminScreen user={user} />;
      case 'auth':
        return <AuthScreen user={user} onUser={setUser} mode={authMode} onModeChange={setAuthMode} />;
      case 'tournaments':
        return <TournamentsScreen user={user} />;
      case 'quiz':
        return <QuizScreen user={user} />;
      default:
        return (
          <HomeScreen
            user={user}
            onGoToTasks={() => setCurrentScreen('tasks')}
            onGoToTournaments={() => setCurrentScreen('tournaments')}
            onGoToQuiz={() => setCurrentScreen('quiz')}
          />
        );
    }
  };

  return (
    <ThemeProvider>
    <div className="min-h-screen bg-background text-on-surface font-body selection:bg-primary selection:text-on-primary">
      <Sidebar
        currentScreen={currentScreen}
        onScreenChange={(s) => {
          if (s === 'auth') setAuthMode('login');
          setCurrentScreen(s);
        }}
        user={user}
      />

      <main className="md:ml-64 min-h-screen flex flex-col pb-16 md:pb-0">
        <TopBar
          currentScreen={currentScreen}
          onScreenChange={setCurrentScreen}
          user={user}
          onSignOut={signOut}
          search={search}
          onSearchChange={setSearch}
          onAuthLogin={() => goAuth('login')}
          onAuthRegister={() => goAuth('register')}
          onOpenTournaments={() => setCurrentScreen('tournaments')}
        />

        <div className="flex-1 overflow-x-hidden custom-scrollbar">{renderScreen()}</div>
      </main>

      <MobileNav
        currentScreen={currentScreen}
        onScreenChange={(s) => {
          if (s === 'auth') setAuthMode('login');
          setCurrentScreen(s);
        }}
        user={user}
      />
    </div>
    </ThemeProvider>
  );
}
