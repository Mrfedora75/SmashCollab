        
          <DeckStage channel={pitching.channel} subscribers={pitching.subscribers} />
        </main>
        <aside className="hidden w-80 shrink-0 overflow-y-auto border-l border-line xl:block">
          <PitchTray idPrefix="desk" />
        </aside>
      </div>

      <DiscoveryFilters open={filtersOpen} onOpenChange={setFiltersOpen} />

      <Dialog.Root open={pitchesOpen} onOpenChange={setPitchesOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="overlay xl:hidden" />
          <Dialog.Content className="drawer drawer-right border-l border-line bg-ink xl:hidden" aria-describedby={undefined}>
            <div className="flex items-center justify-between border-b border-line px-5 py-3">
              <Dialog.Title className="font-display text-2xl">Pitches</Dialog.Title>
              <Dialog.Close className="press flex size-11 items-center justify-center rounded-full border border-line" aria-label="Close pitches">
                <X className="size-4" />
              </Dialog.Close>
            </div>
            <p className="px-5 pt-4 text-sm text-muted">Queued on this desk. Nothing is emailed.</p>
            <PitchTray idPrefix="sheet" heading={false} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <PremiumModal />
      <OutOfSwipes />
    </div>
    <Dialog.Root open={inboxOpen} onOpenChange={setInboxOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className="drawer drawer-right border-l border-line bg-ink" aria-describedby={undefined}>
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <Dialog.Title className="font-display text-2xl">Matches & Messages</Dialog.Title>
            <Dialog.Close className="press flex size-11 items-center justify-center rounded-full border border-line" aria-label="Close matches">
              <X className="size-4" />
            </Dialog.Close>
          </div>
          <Inbox
            pending={pending}
            accepted={accepted}
            outbound={outbound}
            premium={premium}
            reviews={reviews}
            heading={false}
            onUpgrade={() => {
              setInboxOpen(false);
              openPremium(null);
            }}
            onAccept={(pitch) => {
              const id = `pitch-${pitch.creatorId}`;
              setPending((current) => current.filter((item) => item.creatorId !== pitch.creatorId));
              setAccepted((current) => [
                ...current,
                {
                  id,
                  creatorId: pitch.creatorId,
                  title: pitch.title,
                  when: "Accepted just now",
                  summary: pitch.message,
                },
              ]);
              setThreads((current) => ({
                ...current,
                [id]: [
                  { id: `${id}-them`, from: "them", text: pitch.message },
                  { id: `${id}-you`, from: "you", text: "Accepted. Let's lock the date in this thread." },
                ],
              }));
            }}
            onDecline={(creatorId) => setPending((current) => current.filter((item) => item.creatorId !== creatorId))}
            onOpen={setChatId}
            onReview={(collabId) => {
              setInboxOpen(false);
              setReviewFor(collabId);
            }}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
    <ChatThread
      collab={accepted.find((item) => item.id === chatId) ?? null}
      messages={chatId ? (threads[chatId] ?? []) : []}
      onClose={() => setChatId(null)}
      onSend={(text) => {
        if (!chatId) return;
        setThreads((current) => ({
          ...current,
          [chatId]: [...(current[chatId] ?? []), { id: `you-${Date.now()}`, from: "you", text }],
        }));
      }}
      onBlock={blockOpenThread}
    />
    <ReviewModal
      collabId={reviewFor}
      saved={reviewFor ? reviews[reviewFor] : undefined}
      onClose={() => setReviewFor(null)}
      onReturn={() => {
        setReviewFor(null);
        setInboxOpen(true);
      }}
      onSave={(collabId, review) => setReviews((current) => ({ ...current, [collabId]: review }))}
    />
    <PreferencesModal
      open={prefsOpen}
      pushEnabled={pushEnabled}
      asking={askingPush}
      onOpenChange={setPrefsOpen}
      onToggle={() => {
        if (pushEnabled) {
          setPushEnabled(false);
          return;
        }
        setAskingPush(true);
      }}
      onAllow={() => {
        setPushEnabled(true);
        setAskingPush(false);
      }}
      onBlock={() => {
        setPushEnabled(false);
        setAskingPush(false);
      }}
      blocked={blocked}
      onUnblock={unblockCreator}
    />
    {profile ? (
      <CreatorDashboard
        open={dashboardOpen}
        profile={profile}
        onOpenChange={setDashboardOpen}
        onSave={setProfile}
      />
    ) : null}
    <AgeGate age={age} onChoose={choose} />
    <TermsModal open={age === "adult" && !terms} onAccept={() => setTerms(true)} />
    {age === "adult" && terms && !profile ? <CreateProfile onComplete={setProfile} /> : null}
    <div className="toast" aria-live="polite">
      {toast ? <p className="rounded-control bg-cream px-4 py-3 text-sm font-medium text-ink-text shadow-card">{toast}</p> : null}
    </div>
    </>
  );
}
