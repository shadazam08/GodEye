from schemas import MapMatchRequest, ProviderMatchResponse


def validate_match_links(
    request: MapMatchRequest,
    response: ProviderMatchResponse,
) -> None:
    sample_count = len(request.samples)

    for feature in response.features:
        properties = feature.properties
        geometry_lines = feature.geometry.coordinates
        legs = properties.legs

        # When leg metadata exists, each leg needs its geometry.
        if legs and len(legs) != len(geometry_lines):
            raise ValueError(
                "Route legs do not match geometry lines."
            )

        for leg_index, leg in enumerate(legs):
            coordinates = geometry_lines[leg_index]

            for step in leg.steps:
                if (
                    step.from_index >= len(coordinates)
                    or step.to_index >= len(coordinates)
                ):
                    raise ValueError(
                        "Road step references missing geometry points."
                    )

        seen_indexes: set[int] = set()

        for waypoint in properties.waypoints:
            original_index = waypoint.original_index

            if original_index >= sample_count:
                raise ValueError(
                    "Waypoint references a missing request sample."
                )

            if original_index in seen_indexes:
                raise ValueError(
                    "Duplicate original waypoint index."
                )

            seen_indexes.add(original_index)

            original = request.samples[original_index]
            returned_longitude, returned_latitude = (
                waypoint.original_location
            )

            # Permit small coordinate serialization differences.
            if (
                abs(returned_latitude - original.latitude) > 0.000001
                or abs(returned_longitude - original.longitude) > 0.000001
            ):
                raise ValueError(
                    "Returned original location differs from the request."
                )

            if waypoint.match_type == "matched":
                if (
                    waypoint.location is None
                    or waypoint.match_distance is None
                ):
                    raise ValueError(
                        "Matched waypoint is missing its location or distance."
                    )

            leg_index = waypoint.leg_index
            step_index = waypoint.step_index

            # Missing references cannot establish a road-segment match.
            # They are permitted here for later quality classification.
            if leg_index is None and step_index is None:
                continue

            if leg_index is None or step_index is None:
                raise ValueError(
                    "Waypoint has incomplete road-step references."
                )

            if leg_index >= len(legs):
                raise ValueError(
                    "Waypoint references a missing route leg."
                )

            if step_index >= len(legs[leg_index].steps):
                raise ValueError(
                    "Waypoint references a missing road step."
                )