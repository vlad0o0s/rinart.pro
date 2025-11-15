"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useReveal } from "@/lib/use-reveal";
import type { TeamMember } from "@/types/site";
import styles from "./team-section.module.css";

type TeamSectionProps = {
  members: TeamMember[];
};

type DisplayMember = TeamMember & { clientId: string; order: number };

export function TeamSection({ members }: TeamSectionProps) {
  const sectionRef = useReveal<HTMLElement>({ threshold: 0.2 });
  const normalizedMembers = useMemo<DisplayMember[]>(() => {
    const source = Array.isArray(members) ? members : [];
    const prepared = source.map((member, index) => ({
      ...member,
      order: typeof member.order === "number" ? member.order : index,
      clientId: String(member.id ?? index),
    })) as DisplayMember[];
    return prepared.sort((a, b) => a.order - b.order);
  }, [members]);

  const defaultMemberId = normalizedMembers[0]?.clientId ?? null;
  const [hoveredId, setHoveredId] = useState<string | null>(defaultMemberId);
  const handleActivate = (id: string) => setHoveredId(id);
  const handleDeactivate = () => setHoveredId(defaultMemberId);

  if (!normalizedMembers.length) {
    return null;
  }

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
            {normalizedMembers.map((member) => {
              const mobileImage = member.mobileImageUrl || member.imageUrl;
              return (
                <div key={`mobile-${member.clientId}`} className={styles.mobileProfile}>
                  <div className={styles.mobileImageWrapper}>
                    {mobileImage ? (
                      <Image
                        src={mobileImage}
                        alt={member.name}
                        fill
                        className={styles.mobileImage}
                        sizes="(max-width: 768px) 60vw"
                      />
                    ) : null}
                  </div>
                  <div className={styles.mobileCopy}>
                    <p className={styles.mobileRole}>{member.role ?? member.label}</p>
                    <p className={styles.mobileName}>{member.name}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className={styles.desktopProfiles}>
            {normalizedMembers.map((member, index) => {
              const isActive = hoveredId === member.clientId;
              const imageSrc = member.imageUrl || member.mobileImageUrl;
              return (
                <div
                  key={member.clientId}
                  className={`${styles.profileRow} ${isActive ? styles.profileRowActive : ""}`}
                  onMouseEnter={() => handleActivate(member.clientId)}
                  onMouseLeave={handleDeactivate}
                  onFocus={() => handleActivate(member.clientId)}
                  onBlur={handleDeactivate}
                  tabIndex={0}
                >
                  <p className={styles.profileRole}>{member.label ?? member.role}</p>
                  <p className={styles.profileName}>{member.name}</p>
                  {imageSrc ? (
                    <div
                      className={`${styles.profileImage} ${
                        index === 0 ? styles.profileImagePrimary : styles.profileImageSecondary
                      } ${isActive ? styles.profileImageVisible : ""}`}
                      aria-hidden={!isActive}
                    >
                      <Image src={imageSrc} alt={member.name} fill sizes="(min-width: 1025px) 20vw" />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

