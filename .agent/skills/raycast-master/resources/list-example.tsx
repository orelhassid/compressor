import { List, ActionPanel, Action, useFetch } from "@raycast/api";
export default function Command() {
    const { data, isLoading } = useFetch("https://api.github.com/users/raycast");
    return (
        <List isLoading={isLoading}>
            {data && <List.Item title={data.name} accessories={[{ text: data.login }]} />}
        </List>
    );
}
