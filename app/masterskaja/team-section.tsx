"use client";

import { useState } from "react";
import Image from "next/image";
import { useReveal } from "@/lib/use-reveal";
import styles from "./team-section.module.css";

const MOBILE_MEMBERS = [
  {
    name: "Ринат Гильмутдинов",
    role: "Архитектор. Руководитель мастерской",
    image: "/img/team-rinat.webp",
  },
  {
    name: "Вадим Надршин",
    role: "Дизайнер",
    image: "/img/team-vadim.jpg",
  },
];

const DESKTOP_MEMBERS = [
  {
    id: "rinat-gilmutdinov",
    label: "руководитель мастерской",
    name: "Ринат Гильмутдинов",
    image: "/img/team-rinat.webp",
    imageClassName: styles.profileImagePrimary,
  },
  {
    id: "vadim-nadrshin",
    label: "Дизайнер",
    name: "Вадим Надршин",
    image: "/img/team-vadim-alt.jpg",
    imageClassName: styles.profileImageSecondary,
  },
];

const DEFAULT_MEMBER_ID = DESKTOP_MEMBERS[0]?.id ?? null;

export function TeamSection() {
  const [hoveredId, setHoveredId] = useState<string | null>(DEFAULT_MEMBER_ID);
  const sectionRef = useReveal<HTMLElement>({ threshold: 0.2 });

  const handleActivate = (id: string) => setHoveredId(id);
  const handleDeactivate = () => setHoveredId(DEFAULT_MEMBER_ID);

  return (
    <section ref={sectionRef} className={styles.section} id="team" data-visible="false">
      <div className={styles.wrapper}>
        <div className={styles.markerColumn}>
          <p className={styles.marker}>
            <em>(II)</em> КОМАНДА
          </p>
        </div>

        <div className={styles.imageColumn}>
          <div className={styles.imagePlaceholder} aria-hidden="true" />
        </div>

        <div className={styles.contentColumn}>
          <p className={styles.intro}>
            Каждая работа -формирует новые задачи, имеет свои особые условия и настроения, отвечая на
            них каждый раз изобретаешь что-то новое.
          </p>

          <div className={styles.mobileProfiles}>
            {MOBILE_MEMBERS.map((member) => (
              <div key={member.name} className={styles.mobileProfile}>
                <div className={styles.mobileImageWrapper}>
                  <Image
                    src={member.image}
                    alt={member.name}
                    fill
                    className={styles.mobileImage}
                    sizes="(max-width: 768px) 60vw"
                  />
                </div>
                <div className={styles.mobileCopy}>
                  <p className={styles.mobileRole}>{member.role}</p>
                  <p className={styles.mobileName}>{member.name}</p>
                </div>
              </div>
            ))}
          </div>

          <div className={styles.desktopProfiles}>
            {DESKTOP_MEMBERS.map((member) => {
              const isActive = hoveredId === member.id;
              return (
                <div
                  key={member.id}
                  className={`${styles.profileRow} ${isActive ? styles.profileRowActive : ""}`}
                  onMouseEnter={() => handleActivate(member.id)}
                  onMouseLeave={handleDeactivate}
                  onFocus={() => handleActivate(member.id)}
                  onBlur={handleDeactivate}
                  tabIndex={0}
                >
                  <p className={styles.profileRole}>{member.label}</p>
                  <p className={styles.profileName}>{member.name}</p>
                  <div
                    className={`${styles.profileImage} ${member.imageClassName} ${
                      isActive ? styles.profileImageVisible : ""
                    }`}
                    aria-hidden={!isActive}
                  >
                    <Image
                      src={member.image}
                      alt={member.name}
                      fill
                      sizes="(min-width: 1025px) 20vw"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

