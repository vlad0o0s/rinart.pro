'use client';

import { useCallback, useState } from "react";
import styles from "./page.module.css";
import { ProjectInfo } from "./project-info";
import { ProjectMedia } from "./project-media";

type ProjectBodyProps = {
  title: string;
  descriptionHtml?: string | null;
  descriptionParagraphs: string[];
  featureImage?: string | null;
  schemes: { title: string; image: string }[];
  gallery: string[];
};

export default function ProjectBody({
  title,
  descriptionHtml,
  descriptionParagraphs,
  featureImage,
  schemes,
  gallery,
}: ProjectBodyProps) {
  const [infoHeight, setInfoHeight] = useState<number | null>(null);
  const handleHeightChange = useCallback((height: number | null) => {
    setInfoHeight(height);
  }, []);

  return (
    <div className={styles.layout}>
      <ProjectInfo
        title={title}
        descriptionHtml={descriptionHtml}
        descriptionParagraphs={descriptionParagraphs}
        onHeightChange={handleHeightChange}
        featureImage={featureImage}
      />
      <ProjectMedia
        title={title}
        featureImage={featureImage}
        schemes={schemes}
        gallery={gallery}
        infoHeight={infoHeight}
      />
    </div>
  );
}

