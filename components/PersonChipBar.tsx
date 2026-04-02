"use client";

import { useState } from "react";

export default function PersonChipBar() {
  const [people, setPeople] = useState(["You"]);
  const [active, setActive] = useState("You");

  function handleAdd() {
    const name = prompt("Enter a name:");
    if (!name?.trim()) return;
    const trimmed = name.trim();
    setPeople((prev) => [...prev, trimmed]);
    setActive(trimmed);
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {people.map((person) => (
        <button
          key={person}
          onClick={() => setActive(person)}
          className={`rounded-full px-3 py-1 text-[12px] border transition-colors duration-150 ${
            active === person
              ? "bg-field text-primary border-green"
              : "text-secondary border-medium hover:text-primary"
          }`}
        >
          {person}
        </button>
      ))}
      <button
        onClick={handleAdd}
        className="rounded-full px-3 py-1 text-[12px] border border-dashed border-medium text-tertiary hover:text-secondary transition-colors duration-150"
      >
        + Add
      </button>
    </div>
  );
}
