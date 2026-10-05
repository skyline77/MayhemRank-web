<template>
  <header class="board-banner"><slot /></header>
</template>
<style scoped>
.board-banner {
  --banner-shade: rgba(7, 14, 23, 0.64);
  --banner-wash: rgba(7, 14, 23, 0.1);
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: flex-start;
  gap: 12px;
  min-height: 220px;
  padding: 28px 12px 8px;
  box-sizing: border-box;
  background-image:
    linear-gradient(90deg, var(--banner-shade), var(--banner-wash)),
    linear-gradient(0deg, var(--bg), transparent 70%), url('./assets/board-background.webp');
  background-size: cover;
  background-position: center top;
  background-repeat: no-repeat;
}
.board-banner :deep(.board-banner-controls) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
}
.board-banner :deep(.board-banner-controls .board-updated-corner) {
  margin-left: auto;
}
.board-banner :deep(.board-updated-corner) {
  align-self: flex-end;
  text-align: right;
  margin: 0;
}
.board-banner :deep(.board-updated) {
  color: var(--text);
}
.board-banner :deep(.hero-ranking-mode),
.board-banner :deep(.board-message) {
  margin: 0;
}
.board-banner :deep(.combo-pagination) {
  align-self: flex-end;
  margin: 0;
}
:global(:root[data-theme='light'] .board-banner) {
  --banner-shade: rgba(240, 244, 249, 0.8);
  --banner-wash: rgba(240, 244, 249, 0.25);
}
@media (min-width: 701px) {
  .board-banner {
    /* 表头以视口上方 25%（144px至240px） 为目标；内容较高时允许自然撑开。 */
    min-height: calc(var(--board-banner-height) - var(--board-banner-offset, 0px));
    padding-top: 16px;
    background: none;
  }
  .board-banner :deep(.board-banner-controls) {
    flex-wrap: wrap;
  }
  .board-banner :deep(.board-updated-corner) {
    margin-bottom: -4px;
  }
}
@media (max-width: 700px) {
  .board-banner :deep(.board-banner-controls) {
    flex-wrap: wrap;
    row-gap: 8px;
  }
  .board-banner :deep(.board-banner-controls .board-updated-corner),
  .board-banner :deep(.board-banner-controls .combo-pagination) {
    order: -1;
    width: 100%;
  }
  .board-banner {
    min-height: calc(180px - var(--board-banner-offset, 0px));
    margin-top: calc(-1 * var(--nav-tools-height, 116px));
    margin-inline: -16px;
    padding: calc(var(--nav-tools-height, 116px) + 20px) 24px 8px;
    background-position: 58% top;
  }
}
</style>
