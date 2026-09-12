% ==============================================================================
% Yangon Transit - Prolog Knowledge Base & Declarative Route Solver
% File: bus_routes.pl
% Description: Declarative transit knowledge base, deductive route solver,
%              ranking rules, explanation generator, and expert journey auditor.
% ==============================================================================

:- dynamic bus_stop/4.
:- dynamic bus_route/3.
:- dynamic route_stop/3.
:- dynamic stop_alias/2.

% Load the complete Yangon Bus Service network facts (12,280 route-stops, 118 routes)
:- ensure_loaded(ybs_facts).

% ------------------------------------------------------------------------------
% Convenient Named Stop Aliases for Yangon Hubs
% ------------------------------------------------------------------------------

stop_alias('sule', '1').               % Sule Pagoda
stop_alias('hledan', '224').           % Hledan Center
stop_alias('insein', '473').           % Insein BOC
stop_alias('tamwe', '405').            % Tamwe Plaza
stop_alias('thakhin_mya', '702').      % Thakhin Mya Park
stop_alias('aung_mingalar', '1241').   % Aung Mingalar Highway
stop_alias('san_pya', '521').          % San Pya Market
stop_alias('parami', '312').           % Parami
stop_alias('botahtaung', '601').       % Botahtaung Pagoda
stop_alias('dagon_univ', '910').       % Dagon University
stop_alias('junction_square', '198').  % Junction Square

% Also support direct fallback facts for standalone execution without ybs_facts
route_stop('21', 'insein', 1).
route_stop('21', 'hledan', 2).
route_stop('21', 'junction_square', 3).
route_stop('21', 'san_pya', 4).
route_stop('21', 'sule', 5).

route_stop('37', 'insein', 1).
route_stop('37', 'parami', 2).
route_stop('37', 'hledan', 3).
route_stop('37', 'junction_square', 4).
route_stop('37', 'sule', 5).

route_stop('4', 'san_pya', 1).
route_stop('4', 'tamwe', 2).
route_stop('4', 'sule', 3).
route_stop('4', 'thakhin_mya', 4).

route_stop('57', 'hledan', 1).
route_stop('57', 'tamwe', 2).
route_stop('57', 'botahtaung', 3).

route_stop('11', 'aung_mingalar', 1).
route_stop('11', 'parami', 2).
route_stop('11', 'sule', 4).

bus_route('21', '21', 'West Yangon Univ - Maha Bandula (Sule)').
bus_route('37', '37', 'Insein BOC - Sule').
bus_route('4', '4', 'Yuzana Garden - Sule').
bus_route('57', '57', 'Hledan - Tamwe - Botahtaung').
bus_route('11', '11', 'Aung Mingalar - Shwedagon - Sule').

% ------------------------------------------------------------------------------
% Stop Resolution Predicate
% ------------------------------------------------------------------------------

%!  resolve_stop(+Input, -StopId) is semidet.
%   Resolves a stop ID, alias, or case-insensitive name match to a canonical StopId.
resolve_stop(Input, StopId) :-
    (   stop_alias(Input, StopId)
    ;   bus_stop(Input, _, _, _), StopId = Input
    ;   route_stop(_, Input, _), StopId = Input
    ), !.

% ------------------------------------------------------------------------------
% Core Deductive Route Inference Rules
% ------------------------------------------------------------------------------

%!  direct_connection(+FromStop, +ToStop, ?RouteId, -Hops) is nondet.
%   True if FromStop and ToStop are on RouteId and FromStop precedes ToStop.
direct_connection(FromStop, ToStop, RouteId, Hops) :-
    route_stop(RouteId, FromStop, Seq1),
    route_stop(RouteId, ToStop, Seq2),
    Seq1 < Seq2,
    Hops is Seq2 - Seq1.

%!  direct_bus(+FromStop, +ToStop, -RouteId, -RouteNum, -RouteName, -Hops) is nondet.
%   Finds a direct bus route with rich metadata.
direct_bus(FromStop, ToStop, RouteId, RouteNum, RouteName, Hops) :-
    direct_connection(FromStop, ToStop, RouteId, Hops),
    ( bus_route(RouteId, RouteNum, RouteName) -> true ; RouteNum = RouteId, RouteName = 'YBS Line' ).

%!  transfer_connection(+FromStop, +ToStop, -TransferStop, -Route1, -Route2, -TotalHops) is nondet.
%   True if journey from FromStop to ToStop can be completed with 1 transfer at TransferStop.
transfer_connection(FromStop, ToStop, TransferStop, Route1, Route2, TotalHops) :-
    direct_connection(FromStop, TransferStop, Route1, Hops1),
    direct_connection(TransferStop, ToStop, Route2, Hops2),
    Route1 \= Route2,
    FromStop \= TransferStop,
    TransferStop \= ToStop,
    FromStop \= ToStop,
    TotalHops is Hops1 + Hops2.

%!  transfer_bus(+FromStop, +ToStop, -TransferStop, -R1, -R2, -Hops1, -Hops2, -TotalHops) is nondet.
%   Finds 1-transfer journeys with individual leg hop counts.
transfer_bus(FromStop, ToStop, TransferStop, Route1, Route2, Hops1, Hops2, TotalHops) :-
    direct_connection(FromStop, TransferStop, Route1, Hops1),
    direct_connection(TransferStop, ToStop, Route2, Hops2),
    Route1 \= Route2,
    FromStop \= TransferStop,
    TransferStop \= ToStop,
    FromStop \= ToStop,
    TotalHops is Hops1 + Hops2.

%!  valid_stop_sequence(+RouteId, +StopsList) is semidet.
%   Deduces whether a list of stops occurs in strictly ascending sequence on RouteId.
valid_stop_sequence(_, []).
valid_stop_sequence(_, [_]).
valid_stop_sequence(RouteId, [Stop1, Stop2 | Rest]) :-
    route_stop(RouteId, Stop1, Seq1),
    route_stop(RouteId, Stop2, Seq2),
    Seq1 < Seq2,
    valid_stop_sequence(RouteId, [Stop2 | Rest]).

%!  is_transfer_hub(+StopId) is semidet.
%   True if StopId is served by at least 2 distinct bus routes.
is_transfer_hub(StopId) :-
    findall(RouteId, route_stop(RouteId, StopId, _), Routes),
    sort(Routes, UniqueRoutes),
    length(UniqueRoutes, Count),
    Count >= 2.

%!  hub_routes(+StopId, -UniqueRoutes) is det.
%   Returns a list of all distinct routes serving this bus stop.
hub_routes(StopId, UniqueRoutes) :-
    findall(RouteNum, (route_stop(RId, StopId, _), (bus_route(RId, RouteNum, _) -> true ; RouteNum = RId)), Routes),
    sort(Routes, UniqueRoutes).

% ------------------------------------------------------------------------------
% Deductive Explanation Generator ("Why this route?")
% ------------------------------------------------------------------------------

%!  prolog_explain_route(+Type, +Params, -Explanation) is det.
%   Generates natural-language declarative proof explanations for chosen routes.
prolog_explain_route(direct, [RouteNum, Hops], Explanation) :-
    format(atom(Explanation), 'Prolog Proof: Direct Line on YBS ~w with ~w hops. Zero transfer friction.', [RouteNum, Hops]).

prolog_explain_route(transfer, [R1, R2, TransferName, TotalHops], Explanation) :-
    format(atom(Explanation), 'Prolog Proof: Optimal 1-Transfer via ~w (Line ~w -> Line ~w, ~w total hops).', [TransferName, R1, R2, TotalHops]).

% ------------------------------------------------------------------------------
% Declarative Journey Audit Rules
% ------------------------------------------------------------------------------

%!  rule_direct_transit(+LegCount, -Status, -Message) is det.
rule_direct_transit(LegCount, 'pass', 'Direct Transit Verified: No transfer friction; seamless single-bus travel.') :-
    LegCount =:= 1, !.
rule_direct_transit(_, 'info', 'Multi-Leg Journey: Requires vehicle transfer.').

%!  rule_acyclic_path(+StopsList, -Status, -Message) is det.
rule_acyclic_path(StopsList, 'pass', 'Acyclic Route Guarantee: Zero circular loops detected in itinerary.') :-
    is_set(StopsList), !.
rule_acyclic_path(_, 'warning', 'Cycle Warning: One or more bus stops are revisited in itinerary.').

%!  rule_transfer_efficiency(+TransferCount, -Status, -Message) is det.
rule_transfer_efficiency(0, 'pass', 'Zero Transfer Penalty: Maximum travel continuity.') :- !.
rule_transfer_efficiency(1, 'pass', 'Optimal Transfer Efficiency: Single interchange within recommended guideline.') :- !.
rule_transfer_efficiency(_, 'warning', 'Multi-Transfer Complexity: Route requires 2 or more vehicle changes.').

%!  rule_pedestrian_comfort(+WalkMeters, -Status, -Message) is det.
rule_pedestrian_comfort(WalkMeters, 'pass', 'Pedestrian Comfort: Total walking is within the 500m optimal comfort threshold.') :-
    WalkMeters =< 500, !.
rule_pedestrian_comfort(WalkMeters, 'caution', 'Moderate Walking: Total walk exceeds 500m but remains under 1,000m.') :-
    WalkMeters =< 1000, !.
rule_pedestrian_comfort(_, 'warning', 'Extended Walking Alert: Total walk exceeds 1,000m.').

%!  rule_fare_compliance(+LegCount, +Fare, -Status, -Message) is det.
rule_fare_compliance(LegCount, Fare, 'pass', 'Fare Logic Verified: Complies with standard 400 MMK flat-fare rule per bus leg.') :-
    ExpectedFare is LegCount * 400,
    Fare =:= ExpectedFare, !.
rule_fare_compliance(_, _, 'caution', 'Fare Variance: Differs from standard 400 MMK flat-fare logic.').

%!  rule_interchange_certified(+TransferStop, -Status, -Message) is det.
rule_interchange_certified(TransferStop, 'pass', Message) :-
    is_transfer_hub(TransferStop), !,
    format(atom(Message), 'Interchange Hub Certified: Transfer at ~w verified as multi-route interchange.', [TransferStop]).
rule_interchange_certified(TransferStop, 'caution', Message) :-
    format(atom(Message), 'Interchange Point: Transfer at ~w confirmed.', [TransferStop]).

% ------------------------------------------------------------------------------
% Comprehensive Audit Runner (Returns nested lists for client serialization)
% ------------------------------------------------------------------------------

%!  audit_journey(+LegCount, +WalkMeters, +Fare, +StopsList, +TransferStops, -RulesOut) is det.
audit_journey(LegCount, WalkMeters, Fare, StopsList, TransferStops, RulesOut) :-
    rule_direct_transit(LegCount, S1, M1),
    rule_acyclic_path(StopsList, S2, M2),
    TransferCount is max(0, LegCount - 1),
    rule_transfer_efficiency(TransferCount, S3, M3),
    rule_pedestrian_comfort(WalkMeters, S4, M4),
    rule_fare_compliance(LegCount, Fare, S5, M5),
    audit_transfers(TransferStops, TransferRules),
    append([
        [rule_direct_transit, 'Direct Transit Continuity', 'connectivity', S1, M1],
        [rule_acyclic_path, 'Acyclic Route Proof', 'safety', S2, M2],
        [rule_transfer_efficiency, 'Interchange Efficiency', 'efficiency', S3, M3],
        [rule_pedestrian_comfort, 'Pedestrian Comfort Standard', 'efficiency', S4, M4],
        [rule_fare_compliance, 'Flat-Fare Logic Compliance', 'compliance', S5, M5]
    ], TransferRules, RulesOut).

audit_transfers([], []).
audit_transfers([Stop | Rest], [[rule_interchange_certified, 'Interchange Hub Certification', 'connectivity', S, M] | RulesRest]) :-
    rule_interchange_certified(Stop, S, M),
    audit_transfers(Rest, RulesRest).
