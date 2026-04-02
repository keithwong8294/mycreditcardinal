"use client";

import { useState } from "react";

const defaultPeople = ["Tiff", "Keith"];

export default function PersonChipBar() {
  const [people] = useState(defaultPeople);
  const [active, setActive] = useState(people[0]);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {people.map((person) => (
        <button
          key={person}
          onClick={() => setActive(person)}
          className={`rounded-full px-3 py-1 text-[12px] border transition-colors duration-150 ${
            active === person
              ? "bg-input text-primary border-green"
              : "text-secondary border-medium hover:text-primary"
          }`}
        >
          {person}
        </button>
      ))}
      <button className="rounded-full px-3 py-1 text-[12px] border border-dashed border-medium text-tertiary hover:text-secondary transition-colors duration-150">
        + Add
      </button>
    </div>
  );
}
