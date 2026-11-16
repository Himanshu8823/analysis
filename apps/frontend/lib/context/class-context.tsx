'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/**
 * The class context — the branch, scheme, semester and academic year that
 * every class-scoped screen works on.
 *
 * ## Why this exists
 *
 * A college's exam cell does the same job across a dozen screens: enter
 * marks for Computer Science, semester 5, this year; check the report
 * readiness for that same class; upload the statement for that same class.
 * Before this, each of those screens kept its own four dropdowns and its own
 * state — so the person had to pick the same class again on every screen,
 * and it was easy to check the readiness of one class and generate the
 * report for another.
 *
 * One shared context removes both problems. The class is picked once, it is
 * shown in the bar at the top of every screen, and it is remembered when the
 * person comes back tomorrow.
 *
 * ## Why it is remembered
 *
 * The context is written to `localStorage` and read back on the next visit.
 * The exam cell's work spans days — marks on Monday, the statement on
 * Wednesday, the report on Friday — and asking them to re-establish the
 * class each time is the kind of friction that leads to a report for the
 * wrong class.
 *
 * The stored class is only a *starting point*, never a grant: the server
 * still decides what this member may read, and a class that is no longer
 * available simply shows as "choose a class" again.
 */
export interface ClassContext {
  branchId: string;
  schemeId: string;
  semester: number;
  academicYearId: string;
}

export const EMPTY_CLASS_CONTEXT: ClassContext = {
  branchId: '',
  schemeId: '',
  semester: 1,
  academicYearId: '',
};

interface ClassContextValue {
  /** The class currently being worked on. */
  context: ClassContext;
  /** Whether a class has been chosen. */
  isChosen: boolean;
  /** Sets one part of the class. */
  setPart: <K extends keyof ClassContext>(key: K, value: ClassContext[K]) => void;
  /** Sets the whole class at once. */
  setContext: (next: ClassContext) => void;
  /** Forgets the chosen class. */
  clear: () => void;
}

const ClassContextProviderContext = createContext<ClassContextValue | null>(null);

/** Where the chosen class is remembered between visits. */
const STORAGE_KEY = 'result-analysis.class-context';

/**
 * The semesters a college runs.
 *
 * Eight is the usual maximum for a degree programme. The list is fixed
 * rather than read from the scheme so that a semester can be chosen before
 * the scheme is known — the scheme narrows what is taught, not which
 * semesters exist.
 */
export const SEMESTERS: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8];

interface ClassContextProviderProps {
  children: ReactNode;
}

/**
 * ClassContextProvider — holds the class the member is working on.
 *
 * The stored class is read in an effect, never during the render, because
 * `localStorage` exists only in the browser. Reading it while rendering
 * would make the server render and the first client render disagree, and
 * React would throw the whole tree away and start again.
 */
export function ClassContextProvider({ children }: ClassContextProviderProps) {
  const [context, setContextState] = useState<ClassContext>(EMPTY_CLASS_CONTEXT);
  const [hasRead, setHasRead] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<ClassContext>;
        setContextState({
          branchId: typeof parsed.branchId === 'string' ? parsed.branchId : '',
          schemeId: typeof parsed.schemeId === 'string' ? parsed.schemeId : '',
          semester:
            typeof parsed.semester === 'number' && parsed.semester >= 1 && parsed.semester <= 8
              ? parsed.semester
              : 1,
          academicYearId:
            typeof parsed.academicYearId === 'string' ? parsed.academicYearId : '',
        });
      }
    } catch {
      // A stored value that cannot be read is not worth an error screen — it
      // is treated as "no class chosen yet" and replaced on the next change.
    }
    setHasRead(true);
  }, []);

  /**
   * The class is written back only once the stored one has been read.
   *
   * Writing before the read would overwrite the stored class with the empty
   * one, so a member would lose their class on every reload.
   */
  useEffect(() => {
    if (!hasRead) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(context));
    } catch {
      // A browser with storage turned off still works — the class simply is
      // not remembered between visits.
    }
  }, [context, hasRead]);

  const setPart = useCallback(
    <K extends keyof ClassContext>(key: K, value: ClassContext[K]) => {
      setContextState((previous) => ({ ...previous, [key]: value }));
    },
    [],
  );

  const setContext = useCallback((next: ClassContext) => {
    setContextState(next);
  }, []);

  const clear = useCallback(() => {
    setContextState(EMPTY_CLASS_CONTEXT);
  }, []);

  const value = useMemo<ClassContextValue>(
    () => ({
      context,
      isChosen: !!context.branchId && !!context.schemeId && !!context.academicYearId,
      setPart,
      setContext,
      clear,
    }),
    [context, setPart, setContext, clear],
  );

  return (
    <ClassContextProviderContext.Provider value={value}>
      {children}
    </ClassContextProviderContext.Provider>
  );
}

/**
 * The class the member is working on.
 *
 * Outside the provider this returns an inert context rather than throwing,
 * so a screen that is rendered outside the shell (a test, a storybook) does
 * not crash — it simply has no shared class.
 */
export function useClassContext(): ClassContextValue {
  const value = useContext(ClassContextProviderContext);
  if (value) return value;

  return {
    context: EMPTY_CLASS_CONTEXT,
    isChosen: false,
    setPart: () => undefined,
    setContext: () => undefined,
    clear: () => undefined,
  };
}
