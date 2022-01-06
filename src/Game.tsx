import { useEffect, useState } from "react";
import { Row, RowState } from "./Row";
import dictionary from "./dictionary.json";
import { Clue, clue } from "./clue";
import { Keyboard } from "./Keyboard";
import common from "./common.json";
import { dictionarySet, pick } from "./util";
import { names } from "./names";

enum GameState {
  Playing,
  Won,
  Lost,
}

interface GameProps {
  maxGuesses: number;
  hidden: boolean;
}

const targets = common
  .slice(0, 20000) // adjust for max target freakiness
  .filter((word) => dictionarySet.has(word) && !names.has(word));

function allTargets(wordLength: number) {
  return targets.filter((word) => word.length === wordLength);
}

function Game(props: GameProps) {
  const [gameState, setGameState] = useState(GameState.Playing);
  const [guesses, setGuesses] = useState<string[]>([]);
  const [currentGuess, setCurrentGuess] = useState<string>("");
  const [wordLength, setWordLength] = useState(5);
  const [hint, setHint] = useState<string>(`Make your first guess!`);
  const [targets, setTargets] = useState(allTargets(wordLength));
  const [target, setTarget] = useState(pick(targets));

  const reset = () => {
    setTarget(pick(targets));
    setGuesses([]);
    setCurrentGuess("");
    setHint("");
    setGameState(GameState.Playing);
  };

  const findNewWorstTarget = () => {
    // First, narrow down applicable targets to see which ones are valid given new clue.
    const allValidTargets = targets.filter(tar => guessesAreValidFor(tar, target));

    // Second, sort by which clues are the least helpful.
    const mapped = allValidTargets.map(t => {
      return { word: t, score: scoreClues(t) }
    });
    const scores = mapped.map(m => m.score);
    const minScore = Math.min(...scores);
    const leastHelpful = mapped.filter(tar => tar.score === minScore).map(tar => tar.word);

    // Update our values!
    const newTarget = pick(leastHelpful);
    setTarget(newTarget);
    setTargets(leastHelpful);
    // console.log(newTarget);
    console.log(leastHelpful.length);
    return newTarget;
  };

  const guessesAreValidFor = (newTarget: string, oldTarget: string) => {
    return guesses.every(g => {
      const newClues = clue(g, newTarget);
      const oldClues = clue(g, oldTarget);
      return newClues.every((clue, idx) => clue.clue === oldClues[idx].clue);
    });
  };

  const scoreClues = (tar: string) => {
    const yellowRank = 0.5;
    const greenRank = 1;
    return guesses.reduce((scoreTotal: number, guess: string) => {
      const letters = clue(guess, tar);
      letters.forEach(l => {
        if (l.clue === Clue.Correct) {
          scoreTotal += greenRank;
        } else if (l.clue === Clue.Elsewhere) {
          scoreTotal += yellowRank;
        }
      });
      return scoreTotal;
    }, 0);
  }

  const onKey = (key: string) => {
    if (gameState !== GameState.Playing) {
      if (key === "Enter") {
        reset();
      }
      return;
    }
    if (guesses.length === props.maxGuesses) return;
    if (/^[a-z]$/.test(key)) {
      setCurrentGuess((guess) => (guess + key).slice(0, wordLength));
      setHint("");
    } else if (key === "Backspace") {
      setCurrentGuess((guess) => guess.slice(0, -1));
      setHint("");
    } else if (key === "Enter") {
      if (currentGuess.length !== wordLength) {
        setHint("Too short");
        return;
      }
      if (!dictionary.includes(currentGuess)) {
        setHint("Not a valid word");
        return;
      }
      setGuesses((guesses) => guesses.concat([currentGuess]));
      setCurrentGuess((guess) => "");
      if (currentGuess === target) {
        setHint("You won! (Enter to play again)");
        setGameState(GameState.Won);
      } else if (guesses.length + 1 === props.maxGuesses) {
        setHint(
          `You lost! The answer was ${target.toUpperCase()}. (Enter to play again)`
        );
        setGameState(GameState.Lost);
      } else {
        setHint("");
      }
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) {
        onKey(e.key);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [currentGuess, gameState]);

  useEffect(() => {
    const newWorstTarget = findNewWorstTarget();
    setTarget(newWorstTarget);  
  }, [guesses]);

  let letterInfo = new Map<string, Clue>();
  const rowDivs = Array(props.maxGuesses)
    .fill(undefined)
    .map((_, i) => {
      const guess = [...guesses, currentGuess][i] ?? "";
      const cluedLetters = clue(guess, target);
      const lockedIn = i < guesses.length;
      if (lockedIn) {
        for (const { clue, letter } of cluedLetters) {
          if (clue === undefined) break;
          const old = letterInfo.get(letter);
          if (old === undefined || clue > old) {
            letterInfo.set(letter, clue);
          }
        }
      }
      return (
        <Row
          key={i}
          wordLength={wordLength}
          rowState={lockedIn ? RowState.LockedIn : RowState.Pending}
          cluedLetters={cluedLetters}
        />
      );
    });

  return (
    <div className="Game" style={{ display: props.hidden ? "none" : "block" }}>
      <div className="Game-options">
        <label htmlFor="wordLength">Letters:</label>
        <input
          type="range"
          min="4"
          max="11"
          id="wordLength"
          disabled={guesses.length > 0 || currentGuess !== ""}
          value={wordLength}
          onChange={(e) => {
            const length = Number(e.target.value);
            const newTargets = allTargets(length);
            setTargets(newTargets);
            setTarget(pick(newTargets));
            setWordLength(length);
            setHint(`${length} letters`);
          }}
        ></input>
        <button
          style={{ flex: "0" }}
          disabled={gameState !== GameState.Playing || guesses.length === 0}
          onClick={() => {
            setHint(
              `The answer was ${target.toUpperCase()}. (Enter to play again)`
            );
            setGameState(GameState.Lost);
            (document.activeElement as HTMLElement)?.blur();
          }}
        >
          Give up
        </button>
      </div>
      {rowDivs}
      <p>{hint || `\u00a0`}</p>
      <Keyboard letterInfo={letterInfo} onKey={onKey} />
    </div>
  );
}

export default Game;
