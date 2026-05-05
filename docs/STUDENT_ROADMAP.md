# 🗺️ 8-Week Roadmap to Mastery

This roadmap is designed for a 2nd-year university student to transform from a "hard worker" to a "head of project" by mastering the modern stack.

## 🟢 Phase 1: The Foundation (Weeks 1-2)
**Goal**: Understand why Next.js and TypeScript are used.
- [ ] **TypeScript Types**: Don't use `any`. Define interfaces for every event.
  - *Exercise*: Create a `types/game.ts` and define `interface Room`, `interface Player`, `type GamePhase`.
- [ ] **Tailwind Basics**: Stop writing `.css` files. Learn Flexbox and Grid using Tailwind classes.
  - *Exercise*: Rebuild the landing page using only Tailwind utility classes.

## 🟡 Phase 2: React Component Mastery (Weeks 3-4)
**Goal**: Build reusable, professional UI.
- [ ] **Shadcn/UI Integration**: Install and use the `Button`, `Card`, and `Dialog` components.
- [ ] **Compound Components**: Learn how to build a complex UI by breaking it into smaller pieces (e.g., `PlayerCard`, `ScoreBadge`).
- [ ] **State Management**: Master `useState` and `useReducer` for complex game logic.

## 🟠 Phase 3: Real-time & Logic (Weeks 5-6)
**Goal**: Move the socket logic into Next.js.
- [ ] **Custom Hooks**: Refine `useSocket.ts` to handle reconnection automatically.
- [ ] **Context API**: Use React Context to share the `socket` and `gameState` across all components without "prop drilling".
- [ ] **Zustand (Bonus)**: If the state gets too complex, try [Zustand](https://github.com/pmndrs/zustand) — it's the industry favorite right now for simple state management.

## 🔴 Phase 4: The "Juice" (UI/UX Excellence) (Weeks 7-8)
**Goal**: Make the game feel alive.
- [ ] **Framer Motion**: Add entrance animations for players joining and "shake" animations for wrong answers.
- [ ] **Sound System**: Implement a global sound controller hook (`useSound`).
- [ ] **Optimization**: Use Next.js Image component for icons and `lucide-react` for consistent, crisp icons.

---

## 🏆 How to impress your professor:
1.  **Code Quality**: Use **ESLint** and **Prettier**. When your code is perfectly formatted, it looks professional immediately.
2.  **Documentation**: Keep your technical docs updated. A project with a good `README` and `/docs` folder always gets a higher grade.
3.  **Deployment**: Show it running on a real URL (Render/Vercel) from your own domain.
4.  **Testing**: Write just **one** simple test using `Vitest`. Professors love seeing that you care about stability.
